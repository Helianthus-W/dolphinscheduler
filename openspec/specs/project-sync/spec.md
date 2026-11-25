# project-sync Specification

## Purpose

基座为项目唯一创建入口：基座项目创建经同步服务落到 DolphinScheduler（创建人=门户用户），DS 侧项目级全只读，两端项目由映射表 `t_project_sync_rel` 关联。

## Requirements

### Requirement: DS 项目级写操作封禁
DS SHALL 提供 `security.project-creation.enabled` 配置（默认 true 保持上游行为）。为 false 时，`project:create`/`project:edit`/`project:delete` 权限校验 SHALL 拒绝普通调用（返回 `USER_NO_OPERATION_PERM`，实测 code=30001），`ProjectServiceImpl.update` 与 `deleteProject` 入口 SHALL 同样被拒（update 原走 owner 判定不经权限 key，须显式拦截）；携带合法 `X-Trusted-Client` 共享密钥的请求（服务通道）SHALL 豁免，保证基座同步可用。其他资源类型与查询类接口 SHALL 不受影响。

#### Scenario: 人类用户直连写操作被拒
- **WHEN** 封禁开启（false）且请求不带合法密钥头，调用 `POST /projects` / `PUT /projects/{code}` / `DELETE /projects/{code}`
- **THEN** 三者均返回 `USER_NO_OPERATION_PERM`（create/update/delete 三向 curl 实测）

#### Scenario: 同步服务通道豁免
- **WHEN** 同一封禁下，请求携带合法 `X-Trusted-Client` 与 `X-Portal-User` 头
- **THEN** 创建/更新成功且项目归属断言用户；前端用户即使拿到会话直接调 API 也无密钥头，仍被拒

#### Scenario: 封禁关闭回归
- **WHEN** 配置为 true（yaml 或 `-Dsecurity.project-creation.enabled=true` 覆盖）
- **THEN** `/login/auth-mode` 返回 `projectCreationEnabled:true`，写操作行为与上游一致

### Requirement: DS 前端项目级入口隐藏
DS 项目列表页 SHALL 不再渲染「创建项目」按钮及行内 编辑/删除/工作流组 操作（项目级写入口）；项目内页面（工作流定义/实例、任务等）SHALL 不受影响。前端隐藏由 `/login/auth-mode` 的 `projectCreationEnabled` 驱动，是体验层，强制力以后端封禁为准。

#### Scenario: 列表只读化
- **WHEN** 用户打开项目管理列表且封禁开启
- **THEN** 无创建按钮、行内无编辑/删除/工作流组操作列（页面快照实测）

#### Scenario: 项目内开发不受限
- **WHEN** 用户经项目名进入项目内工作流定义页
- **THEN** 「创建工作流」等入口照常渲染（实测）

### Requirement: 认证模式端点携带项目写策略
`GET /login/auth-mode` 响应 data SHALL 在 `type` 之外携带 `projectCreationEnabled`（布尔，反映 `security.project-creation.enabled` 生效值），供子应用启动时决定是否隐藏项目级写入口；`type` 字段语义不变（向后兼容）。

#### Scenario: 封禁开启时端点暴露策略
- **WHEN** 任意未认证请求调用 `GET /login/auth-mode` 且封禁开启
- **THEN** 返回 `{type: "PORTAL", projectCreationEnabled: false}`（true 档实测亦返回对应值）

### Requirement: 基座创建同步到 DS（dlite-base）
基座 `POST /dlite-base/project/save` 与 `/project/permissionSave`（新增分支）SHALL 在开启 `ds.sync.enabled` 时：事务内写入 `t_project_sync_rel` 的 PENDING 映射（含冗余项目名/创建人，供重试自愈），事务提交后经 `X-Portal-User`+密钥服务断言通道在 DS 创建项目（projectName=cnName，创建人=门户用户）并标记 SYNCED；任何失败 SHALL 落 FAILED+原因 并由 `@Scheduled`（默认 5 分钟）幂等重试（先按名核对存在性补映射，避免重复创建）。映射表 DDL 随 change 交付（`migration/t_project_sync_rel.sql`，幂等建表）。

#### Scenario: 同步成功
- **WHEN** 租户用户在基座新建项目且 DS 可用
- **THEN** 事务提交后 DS 出现同名项目（owner=该用户），映射 SYNCED（dlite-base-web `mvn compile` 编译验证；端到端联调依赖 base 侧部署与 `ds.sync.*` 配置）

#### Scenario: DS 暂时不可用
- **WHEN** 同步调用超时/失败
- **THEN** 基座创建不受影响；映射 FAILED；恢复后定时重试按名核对后成功（幂等设计）

#### Scenario: 同步调用身份
- **WHEN** 同步服务调用 DS 创建接口
- **THEN** 携带创建人用户名的 `X-Portal-User` 头与合法 `X-Trusted-Client` 密钥头，DS 侧项目 owner 即该用户（DS 侧 curl 实测：服务通道创建成功且 userName=断言用户）


### Requirement: 项目载荷携带 DS 项目码
dlite-base 的项目列表载荷（`/project/list` 与 `/project/queryPage`，共用 `ProjectPageVO`）SHALL 携带 `dsProjectCode`（来自 `t_project_sync_rel`，未同步项目为 null）；回填 SHALL 在共同出口 `conventPageInfo` 批量完成，不改变两个接口的其他字段与过滤语义。

#### Scenario: 下拉与列表载荷一致
- **WHEN** 基座顶栏项目下拉（`/project/list`）或项目管理分页（`/project/queryPage`）返回项目列表
- **THEN** 每个已同步项目含 `dsProjectCode`，未同步项目该字段为 null（dlite-base-web 编译验证；端到端待部署）

### Requirement: DS 侧跟随跳转
DS 子应用 SHALL 消费 qiankun 全局状态的 `project` 键：payload 含 `dsProjectCode` 且当前路由处于 `/projects/:code/*` 的其他项目时，`router.replace` 到目标项目总览；payload 无 `dsProjectCode`（未同步）或处于首页/列表页时 SHALL 不跳转。挂载落地页 SHALL 不被劫持。

#### Scenario: 基座切换项目时 DS 跟随
- **WHEN** 用户处于项目 A 的项目内页面，基座切换当前项目到已同步的项目 B
- **THEN** DS 路由替换到 `/projects/{B.dsProjectCode}` 总览，无整页刷新（代码路径就绪，端到端待 base 部署后实测）

#### Scenario: 无映射安全路径
- **WHEN** payload 不含 `dsProjectCode` 或 DS 处于首页/项目列表页
- **THEN** 不发生任何跳转或报错（dev 现网安全路径实测）

### Requirement: 项目列表高亮当前项目
DS 项目列表 SHALL 对宿主当前项目（`project` 键 `dsProjectCode` 命中的行）在项目名称旁渲染「当前」标记，帮助用户识别跟随目标；未命中时不渲染。

#### Scenario: 高亮渲染
- **WHEN** 列表中存在行 code 等于宿主当前项目 dsProjectCode
- **THEN** 项目名旁出现「当前」标签；否则无该标签

### Requirement: 改名同步
基座 `project/save`（含 `permissionSave`）更新分支 SHALL 在事务提交后以创建人身份调用 DS `PUT /projects/{dsCode}` 更新项目名（新名=cnName），成功后同步刷新映射表冗余项目名；失败 SHALL 以 `UPDATE:` 前缀标记 fail_reason 且不做自动重试（自动重试仅面向创建，避免按新名误建）。

#### Scenario: 基座改名
- **WHEN** 租户用户编辑基座项目名称且映射已同步
- **THEN** DS 项目名跟随更新；DS 侧调用失败时基座改名不受影响，映射标记 UPDATE: 失败原因（编译验证，端到端待部署）

### Requirement: 删除同步与约束反向纳入
基座 `project/delete` SHALL 在删除前对已映射项目执行 DS 前置校验：DS 项目下工作流定义数 >0 时 SHALL 抛出业务异常阻断整个删除并提示「请先在数据开发中清理」；为 0 时 SHALL 同步删除 DS 项目；DS 调用异常（网络/超时）SHALL fail-safe 阻断删除。基座删除成功 SHALL 同时清理同步映射。

#### Scenario: 有工作流的项目删除被阻断
- **WHEN** 基座删除已映射且 DS 项目下存在工作流定义的项目
- **THEN** 删除被拒绝并返回明确提示（DS 侧删除约束反向纳入基座，实证依据 DS `DELETE_PROJECT_ERROR_DEFINES_NOT_NULL`）

#### Scenario: 清理后删除成功
- **WHEN** DS 项目下已无工作流定义
- **THEN** DS 项目随基座删除一并删除，映射清理，两端一致

### Requirement: 成员授权同步
基座项目成员的两个写入点——`GET /project/addProjectUserRel`（手工绑定，按 old/new 差集）与项目权限审批通过——SHALL 在事务提交后把差集同步到 DS：新增成员 `grant-project-by-code`（perm=7）、移除成员 `revoke-project`；调用身份 SHALL 为管家账号（`ds.sync.housekeeper-user`，须为 DS admin），目标 DS 用户 id 经 `/users/list-paging` 按门户用户名精确解析；管家未配置时 SHALL 跳过并告警，不影响基座主流程。

#### Scenario: 手工绑定授权
- **WHEN** 项目管理员把用户加入项目（new-old 非空）
- **THEN** 该用户在 DS 侧获得该项目授权，DS 项目列表可见（编译验证，端到端待部署）

#### Scenario: 成员移除
- **WHEN** 手工绑定差集中 old-new 非空
- **THEN** 对应用户在 DS 侧被 revoke，项目从其可见列表消失

#### Scenario: 审批通过授权
- **WHEN** 项目权限审批 status=1
- **THEN** 申请人在 DS 侧获得对应项目授权

### Requirement: 存量回填
DLC SHALL 提供一次性回填 runner（`ds.sync.backfill-enabled=true` 时启动执行）：扫描 `t_project_info_data del=0` 且无映射记录的项目，以 `create_user` 为创建人身份走创建同步（幂等，先按名核对），并输出处理统计；运行完由运维将开关置回 false。

#### Scenario: 存量项目回填
- **WHEN** 开启回填开关且 DS 可用
- **THEN** 历史基座项目逐一在 DS 建项（归属原创建人）并写映射，日志输出处理数
