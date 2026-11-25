# Spec Delta: trusted-auth

## Purpose

基座用户免密换取 DolphinScheduler 后端会话的统一鉴权能力：可信网关端点、自动用户开通、前端静默换取与 401/登出的联动语义。

## ADDED Requirements

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
