# trusted-auth Specification

## Purpose

基座用户免密换取 DolphinScheduler 后端会话的统一鉴权能力：可信网关端点、自动用户开通、前端静默换取与 401/登出的联动语义。

## Requirements

### Requirement: 可信登录端点
The DS backend SHALL expose `POST /dolphinscheduler/login/trusted` accepting a `userName`; it SHALL reject requests whose `X-Trusted-Client` header does not match the configured shared secret (constant-time comparison), and SHALL reject unconditionally when the secret is blank. The endpoint SHALL be reachable without an existing session.

#### Scenario: 信任边界三向实测
- **WHEN** calling the endpoint directly without the header / with a wrong secret / with the correct secret (simulating the gateway)
- **THEN** responses are 10043 rejection, 10043 rejection, and `login success` with a sessionId respectively (verified by three curl calls against `:12345`).

### Requirement: 自动用户开通
The trusted authenticator SHALL resolve the local user by the given user name and SHALL auto-create a `GENERAL_USER` (no password) when absent, then return `{sessionId, securityConfigType}` identical in shape to the password login endpoint, and set the sessionId as an httpOnly cookie.

#### Scenario: 基座用户首次进入
- **WHEN** a base user (e.g. superadmin) with no DS account exchanges for the first time
- **THEN** `getUserInfo` returns a freshly created `GENERAL_USER` profile and subsequent API calls succeed under that identity (verified: user id=2 auto-created, home statistics rendered as superadmin).

### Requirement: 前端静默换取
Under qiankun, when `trustedLoginState.enabled` is true and no DS session exists, the sub-app SHALL exchange the host user (`user.name` from global state) for a DS session via `/dolphinscheduler/login/trusted` on mount; failure SHALL fall back silently to the DS login page (native behavior is unchanged when the flag is false).

#### Scenario: 免登录进入与登出重进
- **WHEN** a logged-in base user opens `/dolphinscheduler/home` with no DS session, and later logs out of DS and reloads
- **THEN** both visits reach the DS home without any DS login page appearing; the DS identity equals the base user name (verified twice, including post-logout re-exchange).

### Requirement: 401 三态处理
The response interceptor SHALL: hold redirects while an exchange is in progress; ignore late 401s whose request session snapshot differs from the current session (stale-response guard); on genuine session loss under enabled+succeeded+qiankun, redirect to the host login (`/login`); otherwise redirect to the DS login page.

#### Scenario: 换取期间的迟到 401
- **WHEN** home APIs fire with an empty/pre-exchange session and their 401 responses arrive after a successful exchange
- **THEN** the fresh session is not cleared and no spurious redirect occurs (verified: race fix in `service.ts`, vue-tsc exit 0).

### Requirement: 登出联动
On host `logout:true` global state, the sub-app SHALL clear its user store and cookie, call `POST /dolphinscheduler/signOut`, and reset exchange state.

#### Scenario: 基座登出广播
- **WHEN** the host dispatches `logout:true` via global state
- **THEN** the sub-app clears session storage and invalidates the server-side session before the host navigates to its login page (verified: handler in `useQiankunState.ts` with fire-and-forget signOut).

### Requirement: PORTAL 身份源模式
当 `security.authentication.type=PORTAL` 时，DS SHALL 废弃自有会话认证，身份统一由基座（门户）认证：浏览器路径经门户会话 cookie 校验（可配端点 + 短 TTL 缓存，fail-closed 401），服务路径仅信任携带合法共享密钥的 `X-Portal-User` 断言头；两路统一按门户用户名解析并登记影子用户（密码 NULL 不可本地登录）后写入 `SESSION_USER`。legacy `token` 头路径 SHALL 保留不动。门户校验请求 SHALL 显式要求 JSON 响应（`Accept: application/json`——门户按内容协商，缺失时返回 XML 导致解析失败）；影子用户并发首击登记 SHALL 按用户名串行化（锁内重查 + 落败重读），避免并发请求重复建号冲突。

#### Scenario: 浏览器携带有效门户会话
- **WHEN** 请求携带有效 `dlite_login_token` cookie 且门户校验返回用户名
- **THEN** 解析为该用户（首次自动登记影子用户），接口正常返回，无需任何 DS 会话（verified: home 四接口全 200，页面渲染，身份=门户用户 xiaowang）

#### Scenario: 会话失效或门户不可用（fail-closed）
- **WHEN** cookie 失效、缺失，或门户校验超时/报错
- **THEN** 返回 401（拦截器既有语义），前端跳转基座登录；不产生任何降级放行

#### Scenario: 服务断言通道
- **WHEN** 请求带合法 `X-Trusted-Client` 密钥与 `X-Portal-User` 用户名（dlite-base 同步服务）
- **THEN** 信任断言身份并解析；**WHEN** 密钥缺失或不匹配而仅带 `X-Portal-User`，**THEN** 拒绝（401）

#### Scenario: 并发首击建号
- **WHEN** 多个请求并发携带同一新门户用户身份（首页首访场景）
- **THEN** 全部成功（一个建号、其余锁内重查），无重复键冲突导致的 401（verified: 3 并行断言 racer001 全 200）

#### Scenario: OFF 档回归
- **WHEN** `security.authentication.type` 为 PASSWORD/LDAP/CASDOOR_SSO/TRUSTED
- **THEN** 现有登录/会话/前端换取链路全部原样工作，PORTAL 代码路径不生效（verified: PASSWORD 下 trusted 换取/sessionId 语义原样）

### Requirement: 认证模式暴露端点
DS SHALL 提供免鉴权端点 `GET /login/auth-mode`（`/login/**` 已在登录拦截器排除路径内）返回当前 `security.authentication.type`，供子应用前端在启动时装配对应认证链路（PORTAL：免换取、免 sessionId、401 跳基座；其他档走既有逻辑）。

#### Scenario: 未认证请求获取模式
- **WHEN** 任意未携带凭证的请求调用 `GET /login/auth-mode`
- **THEN** 返回 `{type: <当前认证类型>}`，不受登录拦截影响（verified: PASSWORD/PORTAL 两档各返回对应值）
