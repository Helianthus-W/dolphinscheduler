# Design: dolphinscheduler-dlite-integration

> 决策均已实施并实测。完整证据（可行性 spike、卡点复盘、验收记录）见 `海豚子插件/` 两份方案文档，此处只固化决策本身。

## 构建方案：保留 Vite + vite-plugin-qiankun

- 决策：不改 webpack。插件 1.0.15 在 Node 16 + Vite 3.2.7 实测可行（隔离 spike）。
- 强制前提：`pnpm.overrides` 固定 `cheerio@1.0.0-rc.10`——否则传递依赖 undici@7 在 Node 16 加载即崩。
- 已知代价：微应用不运行在 qiankun JS 沙盒（插件 README 明示），window 全局量须显式清理（`unmount` 删除 `$message` 等）；基座内加载无 HMR（useDevMode）。

## 鉴权方案：可信网关换取（Trusted Authenticator）

- 信任边界在网关：`X-Trusted-Client` 共享密钥（常量时间比较、空配置拒绝）；直连后端无密钥一律 10043。
- 基座 dev 代理仅对 `/login/trusted` 注入密钥头（其余 API 不带，防冒领任意账号会话）；生产由 nginx 等效（`allow` 内网白名单 + 注入）。
- 换取成功复刻 DS 原生登录写库流程；失败静默落到 DS 登录页兜底（`trustedLoginState.enabled` 开关，关闭即原生行为）。
- 会话语义：DS 会话 7200s 硬过期且校验不刷新；`createSessionIfAbsent` 对有效会话重置计时（续期开关）。滑动续期已分析、暂缓（待对接主应用鉴权模块，见接入方案 6.4-4）。

## 菜单方案：dev 等效 shim + 同构 DML

- 远端 multiMenu 不可控 → 基座 service 层响应合并 shim（唯一事实源 `dolphinschedulerMenuShim.js`），平台方按同构数据配置后端后删 shim 切换，前端零改动。
- 关键机制：tab 作用域依赖基座「dlite-* systemCode → sub_system_code 过滤」；`childrenNav=true` 是主框架 loading 门的前提；`multipleRequest` 无 catch，未知 systemCode 必须 catch 兜底防白屏。

## 失败模式约定

- 集成链路的失败模式以「无异常白屏」为主（loading 门、multipleRequest 悬挂、路由无 404）。约定：白屏第一手段是注入错误钩子（写 document.title），禁止盲猜；DS 侧以 catch-all 404 路由消灭静默空白。
