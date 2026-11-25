# Tasks

- [x] 1. OpenSpec change 建档并通过 `openspec validate --strict`
- [x] 2. DS 后端：`security.project-creation.enabled` 配置 + `ProjectMutationGuard` + `TrustedServiceContext`(ThreadLocal) + 标记 Filter + permissionCheck 三 key 拦截 + update/deleteProject 入口守卫 + yaml
- [x] 3. DS 后端重启，curl 三向实测：直连 create/update/delete 均 30001；服务通道豁免成功；查询不受影响；配置 true 覆盖回归（auth-mode projectCreationEnabled 双向验证）
- [x] 4. DS 前端：项目列表隐藏创建按钮与行内操作列（页面实测）+ 项目内「创建工作流」实测不受影响 + build:prod exit 0
- [x] 5. dlite-base：映射表实体/mapper/XML + DsSyncProperties + DsProjectClient + ProjectDsSyncService（afterCommit+重试）+ save/permissionSave 挂钩 + DDL（dlite-base-web `mvn compile` BUILD SUCCESS；端到端联调依赖 base 部署与 `ds.sync.*` 配置）
- [x] 6. 主 spec 同步（project-sync 新建 capability）；归档（P2 切换跟随 / P3 改名/删除/成员 另开 change）

**实施期记录**：①配置键曾两次放错 yaml 层级（`security.authentication.project-creation` / 根级），最终落位 `security.project-creation.enabled`，教训同 auth_flag——配置键必须以绑定表达式为准逐字核对；②`USER_NO_OPERATION_PERM` 实际 code=30001（非 10093，以实测为准）；③dev 的 DS H2 每次重启重建，curl 幂等测试需以当次实例为准。
