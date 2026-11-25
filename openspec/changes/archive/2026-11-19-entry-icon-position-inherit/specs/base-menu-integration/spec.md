# Spec Delta: base-menu-integration

## MODIFIED Requirements

### Requirement: 首页模块入口
The base portal SHALL render a「数据开发」card in the center module grid that enters this module in-app at `/dolphinscheduler/home`; the legacy「数据开发」card issued by the backend SHALL be filtered out of the grid (exact name match), so only this module's entry remains under that name. The module card SHALL inherit the legacy card's icon (fileName image preferred, iconImage fallback) and SHALL occupy the legacy card's position in the grid order (insert at the legacy index; append when no legacy card exists).

#### Scenario: 门户卡片进入
- **WHEN** a logged-in user clicks the「数据开发」card on the portal
- **THEN** the browser lands at `/dolphinscheduler/home` in the same tab with the module rendered.

#### Scenario: 门户仅保留本模块的数据开发入口
- **WHEN** a logged-in user opens the portal
- **THEN** exactly one「数据开发」card exists; the legacy 数据开发 card is absent.

#### Scenario: 图标与位置继承原数据开发
- **WHEN** the portal renders after the shim processes the card list
- **THEN** the「数据开发」card sits at the legacy card's grid position (first row, third column) and renders the legacy card's icon instead of the default placeholder (verified: portal screenshot).

### Requirement: 全部产品抽屉
The「全部产品」drawer SHALL list this module as「数据开发」and SHALL NOT list the legacy「数据开发」product; the module's product entry SHALL inherit the legacy product's icon; clicking the entry navigates to the module entry.

#### Scenario: 抽屉挂载与点击
- **WHEN** the user opens the top-left drawer and expands 全部产品
- **THEN**「数据开发」appears under this module's product entry and clicking it navigates into the module home.

#### Scenario: 抽屉中数据开发指向本模块
- **WHEN** the drawer renders the product list after filtering
- **THEN** exactly one「数据开发」entry exists and the legacy 数据开发 sub-items (数据建模/运维中心) are absent.
