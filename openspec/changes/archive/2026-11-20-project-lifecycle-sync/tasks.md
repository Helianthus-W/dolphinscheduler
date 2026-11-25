# Tasks

- [x] 1. OpenSpec change 建档并通过 `openspec validate --strict`
- [x] 2. DsProjectClient 扩展：update/delete/countProcessDefinitions/findUserIdByName/grant/revoke
- [x] 3. ProjectDsSyncService：syncUpdate（UPDATE: 标记不重试）/ beforeBaseDelete（fail-safe 阻断）/ afterCommitMembers / backfillUnsynced
- [x] 4. 挂钩：save/permissionSave 更新分支（改名）、delete（前置+映射清理）、addProjectUserRel（diff 复用）、审批通过（grant）
- [x] 5. DsSyncProperties：housekeeper-user + backfill-enabled；DsProjectBackfillRunner
- [x] 6. dlite-base-web `mvn compile` BUILD SUCCESS
- [x] 7. 主 spec 同步 + 归档（端到端验收随 base 部署后补测）
