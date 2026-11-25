# Change: 修复首次登录进入数据开发首页永久 loading

## Why

首次登录基座后切换到数据开发，DS 首页（任务实例/工作流实例状态统计）永久转圈，刷新后才正常。根因为两个缺陷叠加：

1. **时序竞态**：`src/main.ts` 先 `app.mount()` 后 `bindQiankun()`，首页 `onMounted` 的统计请求必然在可信登录交换完成前发出（首次本地无会话 → 401）；`service.ts` 对交换窗口内/迟到 401 只吞掉 reject、无重放 → 首屏数据缺失。
2. **组件缺陷**：`use-task-state`/`use-process-state` 的 loading 仅在 `.then` 复位、无错误分支，且 `if (loading) return` 防重入 guard 阻断后续重试 → 一次 reject 永久卡死。

## What

- qiankun 模式下将可信登录交换前置到挂载之前：从宿主全局状态同步取基座用户名，等待交换完成后再 `mount`；失败照常挂载回落登录页；交换增加在途去重。
- 两个首页统计 hook 增加错误分支复位 loading。
- 独立运行路径（无 qiankun props）不触发交换，行为不变。

## Impact

- Affected specs: `qiankun-subapp`（新增 2 条需求）
- Affected code: `dolphinscheduler-ui/src/main.ts`、`src/qiankun/useTrustedLogin.ts`、`src/views/home/use-task-state.ts`、`src/views/home/use-process-state.ts`
- 不影响：独立运行、既有 401 三态语义、trusted-auth 后端契约
