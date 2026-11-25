# Proposal: dolphinscheduler-dlite-integration

## Why

DolphinScheduler UI 需要作为 qiankun 子应用接入 dlite（DataOps）基座，实现：基座统一入口（首页卡片 + 顶部/左侧菜单）、免密统一鉴权（基座用户自动换取 DS 会话）、生产可配置化（后端菜单 DML + 网关分流 + 密钥注入）。实施前各仓库均无 OpenSpec 约束，本 change 为**已完成工作的回溯建档**（实施日期 2026-11-17 ~ 2026-11-18），事实来源为 `海豚子插件/qiankun子应用接入方案.md` 与 `海豚子插件/基座菜单集成实施方案.md`（含全部实测记录），本记录不重复其细节、只固化行为契约。

## What Changes

- `qiankun-subapp`：dolphinscheduler-ui 以注册名 `dolphinscheduler` 导出 qiankun 生命周期（Vite + vite-plugin-qiankun 方案），路由 base 三态适配，独立运行不回归。
- `trusted-auth`：DS 后端新增 `POST /dolphinscheduler/login/trusted` 可信网关登录端点（`X-Trusted-Client` 共享密钥校验、自动建本地用户）；子应用静默换取会话、401 三态处理。
- `base-menu-integration`：基座以 dev 等效 shim（与后端 multiMenu 配置同构）承载海豚调度顶部/左侧菜单；DS 顶栏在 qiankun 模式隐藏；pushState→vue-router 导航桥接；未知 `/dolphinscheduler/*` 路径整页重定向到模块入口。
- `gateway-routing`：页面导航与 API 同前缀（`/dolphinscheduler`）按 Accept 分流；可信登录端点由网关/代理按路径注入密钥；生产配置交付物（菜单 DML、nginx 示例）。

## Impact

- Affected specs: 新增上述 4 个 capability（子应用接入、可信鉴权、基座菜单、网关路由）。
- Affected code: `dolphinscheduler-ui`（入口/路由/service/qiankun 模块）、`dolphinscheduler-api`（TRUSTED 认证）、`dlite-front-main`（注册/代理/shim/主框架补丁）。
- Out of scope: 基座语言/主题切换的动态验证（基座无切换控件，已决策延后）；DS 会话滑动续期（已分析暂缓）；多仓库的 git commit（用户边界，未执行）。
