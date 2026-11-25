# Proposal: entry-icon-position-inherit

## Why

门户上「数据开发」入口需要与原数据开发模块的呈现完全对齐：图标使用原数据开发的图标资源，卡片位置落在原数据开发在卡片区中的原位（第一行第三位）。

## What Changes

- `base-menu-integration`（MODIFIED）：`首页模块入口` 增加图标继承（fileName 优先、iconImage 次之）与位置继承（原卡片下标原位插入）语义；`全部产品抽屉` 增加产品图标继承。dev 由 shim 在过滤原条目前捕获字段实现；生产 DML 的 t_hot_url 插入改为从原卡片行复制 file_name 与 sort。

## Impact

- Affected specs: `base-menu-integration`（2 条需求 MODIFIED）。
- Affected code: `dolphinschedulerMenuShim.js`（shimPortalIndex/shimProducts）；方案文档 6.1 卡片 DML。
