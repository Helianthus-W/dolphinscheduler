# Spec Delta: base-menu-integration

## Purpose

海豚调度模块在基座中的菜单与外壳集成能力：首页入口、顶部 tab 作用域、左侧菜单、全部产品抽屉、子应用外壳适配与未知路径防御。

## ADDED Requirements

### Requirement: 首页模块入口
The base portal SHALL render a「海豚调度」card (name, description, icon) in the center module grid; clicking it SHALL navigate in-app to `/dolphinscheduler/home` (not a new tab).

#### Scenario: 门户卡片进入
- **WHEN** a logged-in user clicks the 海豚调度 card on the portal
- **THEN** the browser lands at `/dolphinscheduler/home` in the same tab with the module rendered (verified: card click, generation jump + home render).

### Requirement: 顶部菜单与 tab 作用域
The「海豚调度」top menu (code `dolphinscheduler`, `pageRefType=3`, `childrenNav=true`) SHALL appear when the current path belongs to the module, and the top tab bar SHALL show only the current app's menus (scoping via `dlite-dolphinscheduler` sub_system_code, the same mechanism as other apps). The menu SHALL NOT leak into other apps' tab bars.

#### Scenario: 双向 tab 作用域
- **WHEN** entering the DS module vs. entering the 数据集成 app
- **THEN** the tab bar shows only 海豚调度 in the first case and only 数据集成 in the second, with no cross-app leakage (verified after scoping the shim to the dlite- subsystem code).

### Requirement: 左侧菜单
Under the module, the base left menu SHALL list exactly 8 items — 首页/项目管理/资源中心/数据质量/源中心/监控中心/安全中心/界面设置 — whose routers SHALL equal the DS `router/modules/*.ts` `path` values prefixed with `/dolphinscheduler` (source of truth is the `path` field, never inferred from route names).

#### Scenario: 菜单路径全量核对
- **WHEN** the 8 menu routers are compared against `grep "path:" router/modules/*.ts`
- **THEN** all match exactly; the previously miswritten `/resources/file-manage` is corrected to `/resource/file-manage` and the page renders in-base (verified: user's re-test + DOM snapshot).

### Requirement: 全部产品抽屉
The「全部产品」drawer (top-left expand menu) SHALL include the 海豚调度 product with its top menu, and clicking it SHALL navigate to the module entry.

#### Scenario: 抽屉挂载与点击
- **WHEN** the user opens the top-left drawer and hovers 全部产品
- **THEN** 海豚调度 appears at the bottom of the product list, and clicking it navigates into the module home (verified: drawer snapshot + click).

### Requirement: 子应用外壳适配
Under qiankun, the DS content layout SHALL hide its own top navbar (menu/界面设置/深色/语言/user) and shift content to full height; the DS login page remains as the fallback channel.

#### Scenario: 基座内外对比
- **WHEN** the same page renders under the base versus standalone `:5173`
- **THEN** under the base the DS navbar is absent and content occupies the full height; standalone keeps the complete navbar (verified: screenshot diff + regression check).

### Requirement: 基座驱动导航
The sub-app SHALL bridge host `history.pushState` navigation into its vue-router (reentrancy-guarded, restored on unmount), so base left-menu clicks switch the content area without full reloads.

#### Scenario: 左侧菜单点击切换
- **WHEN** the user clicks 项目管理 then 监控中心 in the base left menu
- **THEN** the URL changes via pushState and the content area switches to the corresponding DS page without a full reload (verified: two menu clicks, content assertions).

### Requirement: 未知路径处理
A `/dolphinscheduler/*` path that matches no route-table entry SHALL trigger a full-page redirect to `/dolphinscheduler/home` (redirecting to the bare activeRule prefix is prohibited — it loops). Route-table misses for other apps keep their original 404 behavior.

#### Scenario: 陈旧直链自愈
- **WHEN** a browser opens the pre-fix stale URL `/dolphinscheduler/resources/file-manage` (plural) directly
- **THEN** the base redirects to `/dolphinscheduler/home` and renders normally instead of showing the default product with mismatched content (verified: redirect + final render).

### Requirement: dev 等效与生产切换
Menu/portal/route data SHALL be provided by a single-source shim (`dolphinschedulerMenuShim.js`) isomorphic to the backend multiMenu configuration; removing the shim after the platform applies the provided DML SHALL switch to production with zero other frontend changes.

#### Scenario: shim 与 DML 同构
- **WHEN** comparing `DS_LEFT_MENUS`/`DS_TOP_MENU` with the 6.1 DML rows
- **THEN** codes, names, routers, sub_system_code, children_nav and auth flags correspond one-to-one (verified: same values in `dolphinschedulerMenuShim.js` and the DML block).
