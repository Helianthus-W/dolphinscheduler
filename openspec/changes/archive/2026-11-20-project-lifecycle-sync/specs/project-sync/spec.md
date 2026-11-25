# Spec Delta: project-sync

## ADDED Requirements

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
