# Change: 项目一体化——创建同步 + DS 项目级只读化（P1）

## Why

按定稿方案（`海豚子插件/项目一体化同步方案.md`）实施 P1：基座成为项目唯一创建入口，创建时同步到 DS（创建人=门户用户）；DS 侧项目级全只读（浏览器直连不可创建/编辑/删除项目），项目内工作流开发不受影响。切换跟随（P2）与全生命周期其余部分（P3：改名/删除/成员）在后续 change 实施。

## What

**DS 侧（dolphinscheduler-api/ui，本 change 核心）**：
- 新增 `security.project-creation.enabled` 配置（默认 true=上游行为；false=项目级写操作封禁）；
- `ProjectsResourcePermissionCheck.permissionCheck` 对 `project:create/edit/delete` 三个 key 读取该配置；服务调用（合法 `X-Trusted-Client` 密钥）经 `TrustedServiceContext` ThreadLocal 豁免（新 Filter 打标、finally 清除）；
- `ProjectServiceImpl.update/deleteProject` 入口加同一守卫（update 原本走 owner 判定、不经 permissionCheck，必须显式拦）；
- 前端项目列表隐藏「创建项目」按钮与行内 编辑/删除/工作流组 操作（仅项目级入口，项目内功能不动）。

**dlite-base 侧**：`ProjectDsSyncService` + `t_project_sync_rel` 映射 + afterCommit 挂钩 + `@Scheduled` 重试（X-Portal-User 断言通道，经 Change 1 已实施的 PORTAL 身份源）——本 change 交付代码与编译验证，联调依赖 base 侧部署。

## Impact

- Affected specs: `project-sync`（新 capability）
- Affected code: dolphinscheduler-api、dolphinscheduler-ui、dataops-backend/dlite-base
- 依赖：Change 1（PORTAL 身份源，已归档）；不影响 OFF 档认证与其他资源类型（数据源/UDF 等）的权限语义
