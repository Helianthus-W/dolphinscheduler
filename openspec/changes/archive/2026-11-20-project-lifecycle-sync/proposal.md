# Change: 项目全生命周期同步（P3）

## Why

按定稿方案 `海豚子插件/项目一体化同步方案.md` §5 补齐全生命周期：改名同步、删除同步（DS 工作流定义约束反向纳入基座删除流程）、成员授权同步（手工绑定 diff + 审批通过两写入点）、存量回填 runner。至此项目一体化的创建/改名/删除/成员四件事全链路闭环。

## What

- **改名同步**：`save/permissionSave` 更新分支 afterCommit → 以创建人身份 `PUT /projects/{dsCode}`（新名）；失败标记 `UPDATE:` 前缀且不做自动重试（避免误建）。
- **删除同步**：`delete` 前置 `beforeBaseDelete`——已映射项目先查 DS 工作流定义数（`GET /projects/{dsCode}/process-definition/query-process-definition-list`），>0 抛业务异常阻断删除并提示「请先在数据开发中清理」；为 0 则同步删 DS 项目；DS 调用失败一律 fail-safe 阻断。基座删除成功后清理映射。
- **成员授权同步**：`addProjectUserRel`（复用其 old/new diff）与审批通过两个写入点 afterCommit → 管家账号（`ds.sync.housekeeper-user`，须 DS admin）按项目逐个 `grant-project-by-code`/`revoke-project`；目标 DS 用户 id 经 `/users/list-paging` 按名解析。
- **存量回填**：`DsProjectBackfillRunner`（`ds.sync.backfill-enabled` 一次性开关）把无映射存量项目按 create_user 身份走创建同步。

## Impact

- Affected specs: `project-sync`（delta 追加）
- 全部 dlite-base 侧改动；DS 侧零改动；端到端联调依赖 base 部署（`ds.sync.*` 配置 + `t_project_sync_rel` 建表）
