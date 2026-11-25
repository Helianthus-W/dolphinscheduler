# Tasks

- [x] 1. OpenSpec change 建档并通过 `openspec validate --strict`
- [x] 2. `main.ts`：render 返回挂载 Promise；`bindQiankun`/`installHostNavigation` 提前到 mount 之前；从 `props.getGlobalState?.()` 同步取基座用户名，等待 `tryTrustedLogin` 完成后再 `mount`；失败/无用户名照常 mount
- [x] 3. `useTrustedLogin.ts`：增加在途去重（并发调用共享同一交换 Promise）；finally 中的 `/login` 回落仅在路由已启动（非 START_LOCATION）时执行
- [x] 4. `use-task-state.ts` / `use-process-state.ts`：请求链增加 `.catch` 复位 loading（返回空数据，允许重试）
- [x] 5. 验证：vite dev 编译无错；独立运行 5173 回归；基座冷路径双环境（外部隐私窗口 + 内置浏览器）实测：交换先于首屏请求（trusted→get-user-info→统计接口全 200），首页一次出数
- [x] 6. 更新 `海豚子插件/qiankun子应用接入方案.md` 修正记录；归档 change（delta 并入主 spec）

**实施期增补（已并入上述任务）**：`pre-mount user=none` 实测暴露 `props.getGlobalState` 取不到基座用户名，新增 `firstBaseUser` 回退——`useQiankunState` 导出首帧全局状态的用户名 Promise，`main.ts` 以 3s 超时竞速等待，保证交换仍先于首屏渲染。临时诊断埋点已全量清除。
