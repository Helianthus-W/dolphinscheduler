# Spec Delta: trusted-auth

## ADDED Requirements

### Requirement: PORTAL 身份源模式
当 `security.authentication.type=PORTAL` 时，DS SHALL 废弃自有会话认证，身份统一由基座（门户）认证：浏览器路径经门户会话 cookie 校验（可配端点 + 短 TTL 缓存，fail-closed 401），服务路径仅信任携带合法共享密钥的 `X-Portal-User` 断言头；两路统一按门户用户名解析并登记影子用户（密码 NULL 不可本地登录）后写入 `SESSION_USER`。legacy `token` 头路径 SHALL 保留不动。

#### Scenario: 浏览器携带有效门户会话
- **WHEN** 请求携带有效 `dlite_login_token` cookie 且门户校验返回用户名
- **THEN** 解析为该用户（首次自动登记影子用户），接口正常返回，无需任何 DS 会话

#### Scenario: 会话失效或门户不可用（fail-closed）
- **WHEN** cookie 失效、缺失，或门户校验超时/报错
- **THEN** 返回 401（拦截器既有语义），浏览器前端跳转基座登录；不产生任何降级放行

#### Scenario: 服务断言通道
- **WHEN** 请求带合法 `X-Trusted-Client` 密钥与 `X-Portal-User` 用户名（dlite-base 同步服务）
- **THEN** 信任断言身份，按该用户名解析；**WHEN** 密钥缺失或不匹配而仅带 `X-Portal-User`，**THEN** 拒绝（401）

#### Scenario: 缓存与登出传播
- **WHEN** 身份校验结果被缓存（TTL 30s），期间基座登出使门户会话失效
- **THEN** 最迟 TTL 过期后 DS 侧请求返回 401

#### Scenario: OFF 档回归
- **WHEN** `security.authentication.type` 为 PASSWORD/LDAP/CASDOOR_SSO/TRUSTED
- **THEN** 现有登录/会话/前端换取链路全部原样工作，PORTAL 代码路径不生效

### Requirement: 认证模式暴露端点
DS SHALL 提供免鉴权端点 `GET /login/auth-mode`（`/login/**` 已在登录拦截器排除路径内）返回当前 `security.authentication.type`，供子应用前端在启动时装配对应认证链路（PORTAL 免换取、401 跳基座；其他档走既有逻辑）。

#### Scenario: 未认证请求获取模式
- **WHEN** 任意未携带凭证的请求调用 `GET /login/auth-mode`
- **THEN** 返回 `{type: <当前认证类型>}`，不受登录拦截影响
