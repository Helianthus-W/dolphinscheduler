# Change: 项目切换自动跟随（P2）

## Why

按定稿方案 `海豚子插件/项目一体化同步方案.md` §4：基座顶栏切换项目时 DS 侧自动跟随跳转。基座 `projectChange` 已把当前项目经 qiankun `project` 键实时下发（dlite-front-main index.jsx:785-810），本 change 补齐两端：dlite-base 让项目载荷携带 `dsProjectCode`，DS 子应用消费并跟随。

## What

- dlite-base：`ProjectPageVO` 增加 `dsProjectCode`；`conventPageInfo`（`/project/list` 与 `/project/queryPage` 的共同回填点）批量联 `t_project_sync_rel` 回填。
- DS 前端：新增 `useHostProjectFollow`——消费 qiankun `project` 键；处于其他项目内页且 payload 含 `dsProjectCode` 时 `router.replace` 跟随跳转；无映射不跳（安全路径）；项目列表对当前项目打「当前」标记。
- 不劫持挂载落地页（首页/列表不强制跳），与方案 §4 一致。

## Impact

- Affected specs: `project-sync`（delta 追加）
- 依赖：P1（已归档）；正向联动（payload 带 dsProjectCode）端到端待 dlite-base 部署后实测，dev 现网验证安全路径（无映射不跳、无报错）
