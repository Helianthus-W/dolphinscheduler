# Proposal: rename-module-entry-to-data-dev

## Why

海豚调度模块在基座中的对外名称需要改为「数据开发」，承接原数据开发模块的定位；原数据开发模块的入口（门户卡片、全部产品抽屉、顶部菜单）下线，用户不再能从基座导航进入原模块。

## What Changes

- `base-menu-integration`（MODIFIED）：模块入口显示名由「海豚调度」改为「数据开发」——门户卡片、顶部菜单 tab、全部产品抽屉项、面包屑随之变更（均取自菜单数据 name 字段）；后端下发的原「数据开发」条目（门户卡片/抽屉产品/顶部菜单，精确名称匹配）在 shim 层过滤下线。模块标识（code `dolphinscheduler`、路由前缀、子系统编码 `dlite-dolphinscheduler`）不变。

## Impact

- Affected specs: `base-menu-integration`（3 条需求 MODIFIED：首页模块入口、顶部菜单与 tab 作用域、全部产品抽屉）。
- Affected code: `dlite-front-main/src/service/dolphinschedulerMenuShim.js`（改名 + 过滤）；基座无需其他改动。
- Out of scope: 原数据开发应用本身的下线（服务/路由摘除，属平台侧操作）；DolphinScheduler 应用内部品牌标识（登录页 logo/title 不变）。
