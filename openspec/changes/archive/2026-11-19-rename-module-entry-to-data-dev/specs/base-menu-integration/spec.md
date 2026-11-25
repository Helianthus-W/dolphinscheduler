# Spec Delta: base-menu-integration

## MODIFIED Requirements

### Requirement: 首页模块入口
The base portal SHALL render a「数据开发」card in the center module grid that enters this module in-app at `/dolphinscheduler/home`; the legacy「数据开发」card issued by the backend SHALL be filtered out of the grid (exact name match), so only this module's entry remains under that name.

#### Scenario: 门户卡片进入
- **WHEN** a logged-in user clicks the「数据开发」card on the portal
- **THEN** the browser lands at `/dolphinscheduler/home` in the same tab with the module rendered.

#### Scenario: 门户仅保留本模块的数据开发入口
- **WHEN** a logged-in user opens the portal
- **THEN** exactly one「数据开发」card exists; the legacy 数据开发 card is absent.

### Requirement: 顶部菜单与 tab 作用域
The module's top menu SHALL display as「数据开发」when the current path belongs to the module, and the top tab bar SHALL show only the current app's menus (scoping unchanged, via `dlite-dolphinscheduler`). A backend-issued「数据开发」top menu SHALL be filtered from the menu list before the module's own menu is appended, so the tab name uniquely identifies this module.

#### Scenario: 双向 tab 作用域
- **WHEN** entering the module and inspecting the top tab bar
- **THEN** the tab bar shows only this app's menus under the name「数据开发」; entering the 数据集成 app shows only 数据集成, with no cross-app leakage.

#### Scenario: tab 显示数据开发且唯一
- **WHEN** the base issues a legacy「数据开发」top menu in the same list
- **THEN** it is filtered out before the module's menu is appended, so no second, legacy 数据开发 tab exists in the scoped list.

### Requirement: 全部产品抽屉
The「全部产品」drawer SHALL list this module as「数据开发」and SHALL NOT list the legacy「数据开发」product; clicking the entry navigates to the module entry.

#### Scenario: 抽屉挂载与点击
- **WHEN** the user opens the top-left drawer and expands 全部产品
- **THEN**「数据开发」appears under this module's product entry and clicking it navigates into the module home.

#### Scenario: 抽屉中数据开发指向本模块
- **WHEN** the drawer renders the product list after filtering
- **THEN** exactly one「数据开发」entry exists and the legacy 数据开发 sub-items (数据建模/运维中心) are absent.
