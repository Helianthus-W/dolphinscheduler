# Spec Delta: project-sync

## Purpose

基座为项目唯一创建入口：创建/变更经同步服务落到 DolphinScheduler（创建人=门户用户），DS 侧项目级全只读，两端项目由映射表关联。

## ADDED Requirements

### Requirement: DS 项目级写操作封禁
DS SHALL 提供 `security.project-creation.enabled` 配置（默认 true 保持上游行为）。为 false 时，`project:create`/`project:edit`/`project:delete` 权限校验 SHALL 拒绝普通调用（返回 `USER_NO_OPERATION_PERM`），`ProjectServiceImpl.update` 与 `deleteProject` 入口 SHALL 同样被拒（update 原走 owner 判定不经权限 key，须显式拦截）；携带合法 `X-Trusted-Client` 共享密钥的请求（服务通道）SHALL 豁免，保证基座同步可用。其他资源类型与查询类接口 SHALL 不受影响。

#### Scenario: 人类用户直连写操作被拒
- **WHEN** 封禁开启（false）且请求不带合法密钥头，调用 `POST /projects` / `PUT /projects/{code}` / `DELETE /projects/{code}`
- **THEN** 三者均返回 `USER_NO_OPERATION_PERM`（实测 code=30001；create/update/delete 三向 curl 验证）

#### Scenario: 同步服务通道豁免
- **WHEN** 同一封禁下，请求携带合法 `X-Trusted-Client` 与 `X-Portal-User` 头
- **THEN** 创建成功且项目归属断言用户；前端用户即使拿到会话直接调 API 也无密钥头，仍被拒

#### Scenario: 封禁关闭回归
- **WHEN** 配置为 true（或未配置）
- **THEN** 创建/编辑/删除行为与上游完全一致（默认放行）

### Requirement: DS 前端项目级入口隐藏
DS 项目列表页 SHALL 不再渲染「创建项目」按钮及行内 编辑/删除/工作流组 操作（项目级写入口）；项目内页面（工作流定义/实例、任务、资源使用等）SHALL 不受影响。前端隐藏是体验层，强制力以后端封禁为准。

#### Scenario: 列表只读化
- **WHEN** 用户打开项目管理列表
- **THEN** 无创建按钮、行内无编辑/删除/工作流组操作列，仅剩项目名进入与搜索/分页（verified: 页面快照）

#### Scenario: 项目内开发不受限
- **WHEN** 用户经项目名进入项目内工作流定义页
- **THEN** 工作流的创建/编辑/删除入口全部照常（verified: 路由与按钮渲染）

### Requirement: 基座创建同步到 DS（dlite-base）
基座 `POST /dlite-base/project/save`（新增分支）SHALL 在事务提交后触发 `ProjectDsSyncService`：以创建人门户用户名经 `X-Portal-User`+密钥断言直连 DS 创建项目（projectName=cnName），并写入映射表 `t_project_sync_rel(base_project_code, ds_project_code, status)`；失败 SHALL 记录 `FAILED+原因` 并由 `@Scheduled` 定时重试（重试先核对存在性，幂等）。映射表无对应记录的历史基座项目与 DS 孤儿项目 SHALL 由存量回填脚本处理（单独交付）。

#### Scenario: 同步成功
- **WHEN** 租户用户在基座新建项目且 DS 可用
- **THEN** 事务提交后 DS 出现同名项目（创建人=该用户），映射表状态 SYNCED，重试任务不触发

#### Scenario: DS 暂时不可用
- **WHEN** 同步调用超时/失败
- **THEN** 基座创建不受影响；映射表 FAILED；恢复后定时重试成功（先按名/按码核对存在性避免重复创建）

#### Scenario: 同步调用身份
- **WHEN** 同步服务调用 DS 创建接口
- **THEN** 请求携带创建人用户名的 `X-Portal-User` 头与合法 `X-Trusted-Client` 密钥头（服务通道豁免封禁），DS 侧项目 owner 即该用户

### Requirement: 认证模式端点携带项目写策略
`GET /login/auth-mode` 响应 data SHALL 在 `type` 之外携带 `projectCreationEnabled`（布尔，反映 `security.project-creation.enabled` 生效值），供子应用启动时决定是否隐藏项目级写入口；`type` 字段语义不变（向后兼容，trusted-auth 的既有消费方不受影响）。

#### Scenario: 封禁开启时端点暴露策略
- **WHEN** 任意未认证请求调用 `GET /login/auth-mode` 且封禁开启
- **THEN** 返回 `{type: "PORTAL", projectCreationEnabled: false}`（实测两档各返回对应值）
