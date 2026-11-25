# Change: PORTAL 身份源——废弃 DS 自有会话认证，统一走基座认证

## Why

项目一体化方案（`海豚子插件/项目一体化同步方案.md` §2.0）的核心变更：身份源开关 ON 时 DS 不再签发/校验自有会话，身份一律由基座（门户）认证，DS 用户表退化为影子/技术引用表。收益：DS 会话 7200s 过期与续期问题消亡、登出=基座登出、项目创建人天然=门户用户。

## What

- `AuthenticationType.PORTAL` + `PortalAuthenticator`（挂现有 `Authenticator` SPI，`LoginHandlerInterceptor` 零改动）：
  - 浏览器路径：转发门户会话 cookie（`dlite_login_token`）到门户校验端点（默认 `/dlite-portal/oauth/token/getUser`），短 TTL 缓存（默认 30s），fail-closed（401）；
  - 服务路径：`X-Portal-User` + `X-Trusted-Client` 共享密钥断言（常量时间比对，复用 `security.authentication.trusted.shared-secret`）；
  - 两路统一解析：门户用户名 → 查/登记影子用户（GENERAL_USER，密码 NULL 天然不可登录）→ `SESSION_USER`。
- `GET /login/auth-mode` 免鉴权端点暴露当前认证类型，供前端装配。
- 保留 legacy `token` 头路径（定时调度改造直接调 DS API 依赖）。
- OFF 档（PASSWORD/LDAP/CASDOOR/TRUSTED）全部原样；前端 OFF 档链路原样。

## Impact

- Affected specs: `trusted-auth`（新增 2 条需求）
- Affected code: dolphinscheduler-api（security/controller/yaml）、dolphinscheduler-ui（authMode 感知）
- 不改动：`LoginHandlerInterceptor`、token 头路径、OFF 档全部行为
