# Spec Delta: project-sync

## ADDED Requirements

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
