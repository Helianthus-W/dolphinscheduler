# Spec Delta: gateway-routing

## Purpose

生产网关对 /dolphinscheduler 前缀的分流与安全能力：页面与 API 按意图分流、可信密钥按路径注入、部署收敛与生产配置交付物。

## ADDED Requirements

### Requirement: 页面与 API 同前缀分流
Requests under `/dolphinscheduler` SHALL be routed by content intent: browser page navigations (`Accept: text/html`) SHALL be served by the base app; API/XHR requests SHALL be proxied to the DS backend with no path rewrite (the DS API carries the `/dolphinscheduler` context path).

#### Scenario: 整页导航与 XHR 各自到达正确的后端
- **WHEN** a full page load requests `/dolphinscheduler/home` with `Accept: text/html`, versus an XHR posting to `/dolphinscheduler/login`
- **THEN** the first receives the base index.html and the second reaches the DS backend returning `login success` with a sessionId cookie (verified: two curl calls through `:2024`).

### Requirement: 密钥按路径注入
The `X-Trusted-Client` shared secret SHALL be injected only for `/dolphinscheduler/login/trusted`; other API requests SHALL NOT carry the secret header (prevents minting sessions for arbitrary accounts through the gateway).

#### Scenario: 代理注入范围
- **WHEN** any request passes the base dev proxy
- **THEN** only requests whose path contains `/login/trusted` carry the injected `X-Trusted-Client` header; a caller-supplied wrong secret on that path is overwritten by the proxy (verified: negative test returned success via proxy but rejection when hitting the backend directly).

### Requirement: 生产部署收敛
The DS backend SHALL be reachable only through the gateway/reverse proxy; the trusted endpoint additionally SHALL be restricted to internal sources (e.g. nginx `allow`/`deny`). The secret SHALL be supplied via deployment configuration, never committed.

#### Scenario: 直连后端被拒
- **WHEN** a client calls the trusted endpoint on the DS backend directly without the secret header
- **THEN** the response is `10043 user login failure` regardless of userName (verified: direct call without header).

### Requirement: 生产配置交付物
The integration SHALL ship: (a) executable menu DML for `t_function_dict`/`t_function_language_rel`/`t_hot_url` isomorphic to the shim (sub_system_code `dlite-dolphinscheduler`, `user_type='0'`, `auth_flag=1`, `children_nav=1`); (b) an nginx sample implementing the split-routing and secret injection above.

#### Scenario: DML 与查询语义一致
- **WHEN** reviewing the DML against `MultiLevelMenuMapper.xml` filter conditions (function_type/parent_code/visible/user_type/sub_system_code/children_nav loading gate)
- **THEN** every filter column value in the DML satisfies the corresponding query predicate, so the menus appear after execution without frontend changes (verified: mapper SQL walkthrough in 基座菜单集成实施方案 6.1).
