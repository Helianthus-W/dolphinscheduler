# base-menu-integration Specification

## Purpose

海豚调度模块在基座中的菜单与外壳集成能力：首页入口、顶部 tab 作用域、左侧菜单、全部产品抽屉、子应用外壳适配与未知路径防御。

## Requirements

### Requirement: 首页模块入口
The base portal SHALL render a「数据开发」card in the center module grid that enters this module in-app at `/dolphinscheduler/home`; the legacy「数据开发」card issued by the backend SHALL be filtered out of the grid (exact name match), so only this module's entry remains under that name. The card SHALL inherit the legacy card's icon and its position in the grid order.

#### Scenario: 门户卡片进入
- **WHEN** a logged-in user clicks the「数据开发」card on the portal
- **THEN** the browser lands at `/dolphinscheduler/home` in the same tab with the module rendered.

#### Scenario: 门户仅保留本模块的数据开发入口
- **WHEN** a logged-in user opens the portal
- **THEN** exactly one「数据开发」card exists; the legacy 数据开发 card is absent.

#### Scenario: 图标与位置继承原数据开发
- **WHEN** the portal renders after the shim processes the card list
- **THEN** the「数据开发」card is inserted at the legacy card's grid index (append when no legacy card exists; first row, third column in the current portal) and renders the legacy card's icon (fileName image preferred, iconImage fallback) instead of the default placeholder (verified: portal screenshot).

### Requirement: 顶部菜单与 tab 作用域
The module's top menu SHALL display as「数据开发」when the current path belongs to the module, and the top tab bar SHALL show only the current app's menus (scoping unchanged, via `dlite-dolphinscheduler`). A backend-issued「数据开发」top menu SHALL be filtered from the menu list before the module's own menu is appended, so the tab name uniquely identifies this module.

#### Scenario: 双向 tab 作用域
- **WHEN** entering the module and inspecting the top tab bar
- **THEN** the tab bar shows only this app's menus under the name「数据开发」; entering the 数据集成 app shows only 数据集成, with no cross-app leakage.

#### Scenario: tab 显示数据开发且唯一
- **WHEN** the base issues a legacy「数据开发」top menu in the same list
- **THEN** it is filtered out before the module's menu is appended, so no second, legacy 数据开发 tab exists in the scoped list.

### Requirement: 左侧菜单
Under the module, the base left menu SHALL list exactly 8 items — 首页/项目管理/资源中心/数据质量/源中心/监控中心/安全中心/界面设置 — whose routers SHALL equal the DS `router/modules/*.ts` `path` values prefixed with `/dolphinscheduler` (source of truth is the `path` field, never inferred from route names).

#### Scenario: 菜单路径全量核对
- **WHEN** the 8 menu routers are compared against `grep "path:" router/modules/*.ts`
- **THEN** all match exactly; the previously miswritten `/resources/file-manage` is corrected to `/resource/file-manage` and the page renders in-base (verified: user's re-test + DOM snapshot).

### Requirement: 全部产品抽屉
The「全部产品」drawer SHALL list this module as「数据开发」and SHALL NOT list the legacy「数据开发」product; the module's product entry SHALL inherit the legacy product's icon; clicking the entry navigates to the module entry.

#### Scenario: 抽屉挂载与点击
- **WHEN** the user opens the top-left drawer and expands 全部产品
- **THEN**「数据开发」appears under this module's product entry and clicking it navigates into the module home.

#### Scenario: 抽屉中数据开发指向本模块
- **WHEN** the drawer renders the product list after filtering
- **THEN** exactly one「数据开发」entry exists and the legacy 数据开发 sub-items (数据建模/运维中心) are absent.

### Requirement: 子应用外壳适配
Under qiankun, the DS content layout SHALL hide its own top navbar (menu/界面设置/深色/语言/user) and shift content to full height; the DS login page remains as the fallback channel.

#### Scenario: 基座内外对比
- **WHEN** the same page renders under the base versus standalone `:5180`
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
