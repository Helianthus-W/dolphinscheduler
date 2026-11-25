# qiankun-subapp Delta Spec

## ADDED Requirements

### Requirement: 可信登录先于首屏渲染
子应用在 qiankun 模式下 SHALL 在挂载 Vue 应用之前完成可信登录交换：优先从 `props.getGlobalState()` 同步取得基座用户名，取不到时 SHALL 回退为等待首个全局状态下发的用户名（带超时竞速，超时未获取则照常挂载）；随后等待 `/login/trusted` 交换及用户初始化完成后再执行 `app.mount`；交换调用 SHALL 具备在途去重（并发触发只发起一次交换）。交换失败或最终未取得基座用户名时 SHALL 照常挂载并回落 DS 登录页兜底；独立运行（无 qiankun props）路径 SHALL 不触发交换、直接挂载。

#### Scenario: 首次登录进入数据开发首页（冷路径）
- **WHEN** 用户首次登录基座并切换到数据开发（子应用本地无 DS 会话、基座经 `initGlobalState` 下发用户）
- **THEN** 挂载前取得基座用户名并完成交换，`exchange-ok` 先于任何业务请求；首页统计等首屏请求全部 200，页面一次渲染成功、数据正常展示，不出现 401/永久 loading/「无数据」假空（外部隐私窗口与内置浏览器双环境实测通过）

#### Scenario: 交换失败兜底
- **WHEN** TRUSTED 交换失败（后端未部署/网络异常）且处于 qiankun 模式
- **THEN** 子应用照常挂载，无会话请求 401 后回落 DS 登录页（与既有兜底一致），进程不阻塞、不出现路由未启动时的跳转副作用

#### Scenario: 独立运行回归
- **WHEN** 直接访问 dev server（无 qiankun props）
- **THEN** 不触发交换逻辑，`mount` 行为与上游一致（独立登录页流程不变）

### Requirement: 首页统计组件错误恢复
首页统计 hook（`use-task-state`/`use-process-state`）SHALL 在请求失败（reject）时复位 loading 状态并返回空数据，保证一次失败的请求不会导致组件永久 loading，且用户可通过切换日期重新发起查询。

#### Scenario: 首访 401 或任意请求异常
- **WHEN** 统计请求 reject（401/超时/网络错误）
- **THEN** loading 复位为 false，表格显示空数据而非永久转圈，防重入 guard 不再阻断后续查询
