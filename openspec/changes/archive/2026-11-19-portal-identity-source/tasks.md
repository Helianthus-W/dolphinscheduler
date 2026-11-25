# Tasks

- [x] 1. OpenSpec change 建档并通过 `openspec validate --strict`
- [x] 2. 后端：`AuthenticationType.PORTAL` + `PortalAuthenticator`（cookie 校验+缓存 / 服务头断言 / 影子用户登记）+ `SecurityConfig` 分支
- [x] 3. 后端：`GET /login/auth-mode` 端点
- [x] 4. 后端：standalone `application.yaml`（type=PORTAL + portal 校验地址配置）+ 模块编译通过（mvn install BUILD SUCCESS 12min）
- [x] 5. 前端：启动获取 authMode；PORTAL 档跳过换取/免 sessionId/401 跳基座；OFF 档全保留（build:prod exit 0）
- [x] 6. 验证（全绿）：auth-mode=PORTAL；服务头 200/401 全矩阵；影子用户自动登记；浏览器 cookie 路径四接口全 200 + 页面渲染（身份=xiaowang）；并发建号竞态 3 并行全 200；门户 XML 内容协商缺陷修复（Accept: application/json）；OFF 档 PASSWORD 回归全过
- [x] 7. 浏览器正向路径实测通过；文档已更新；归档 change（delta 并入主 spec）
