# Spec Delta: qiankun-subapp

## Purpose

将 dolphinscheduler-ui 作为 qiankun 子应用接入 dlite 基座的能力契约：生命周期导出、路由 base 三态适配、构建依赖固定、卸载清理与未匹配路由的可观测失败。

## ADDED Requirements

### Requirement: 生命周期导出与独立运行兼容
The dolphinscheduler-ui SHALL export qiankun lifecycle functions (`bootstrap`/`mount`/`unmount`/`update`) via vite-plugin-qiankun under the registered name `dolphinscheduler`, and SHALL render standalone when `__POWERED_BY_QIANKUN__` is unset.

#### Scenario: 基座挂载与独立运行
- **WHEN** qiankun fetches the entry from the dev server with the plugin's CORS headers present
- **THEN** the entry exposes `window['dolphinscheduler']` lifecycles and mounts into `#dolphinscheduler-root` inside the host container; direct access to `http://127.0.0.1:5173` renders the same app standalone (verified: entry transform spike + standalone regression).

### Requirement: 路由 base 三态
The router SHALL use base `/dolphinscheduler` under qiankun, `/dolphinscheduler/ui/` for standalone production, and `/` for standalone development.

#### Scenario: qiankun 内路由解析
- **WHEN** the browser is at `/dolphinscheduler/projects/list` under the base
- **THEN** the DS router resolves route `/projects/list` against base `/dolphinscheduler` and renders the projects page (verified: in-base SPA navigation).

### Requirement: 构建依赖固定
The package SHALL pin `cheerio` to `1.0.0-rc.10` via pnpm overrides (transitive undici@7 breaks Node 16), and `pnpm run build:prod` (vue-tsc + vite build) SHALL exit 0.

#### Scenario: 干净环境安装
- **WHEN** `pnpm install` runs on Node 16 without the cheerio override
- **THEN** loading `vite.config.ts` throws `ReadableStream is not defined`; with the override, install and `build:prod` both succeed (verified: isolated spike + two exit-0 builds).

### Requirement: 卸载清理
`unmount` SHALL unmount the Vue app, restore patched `history.pushState`, and remove window globals set by the sub-app (e.g. `$message`).

#### Scenario: 菜单进出循环
- **WHEN** the host switches menus to leave and re-enter the module repeatedly
- **THEN** each mount creates a fresh app instance with restored navigation bridging and no stale window globals (verified: /portal roundtrip without re-login or duplicate-mount anomalies).

### Requirement: 未匹配路由提示
Under qiankun, the router SHALL render a "页面不存在或链接已失效" fallback for unmatched paths (catch-all `/:pathMatch(.*)*`); standalone behavior remains unchanged (no 404 page, upstream behavior).

#### Scenario: 未知 DS 路径
- **WHEN** the sub-app router resolves a path that matches no route while running under qiankun
- **THEN** the fallback hint renders instead of a silent blank content area (verified: route exists in `src/router/index.ts`; qiankun-only conditional).
