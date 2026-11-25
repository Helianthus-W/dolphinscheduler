# DolphinScheduler UI 接入 dlite 基座（qiankun）对接方案

> 状态：**已实施完成并归档**（2026-11-19 本地全链路验证；2026-11-25 测试环境部署验证）。
> 历史记录中的端口号以撰写时为准，见文首"变更说明"。
> 变更说明（2026-11-23）：DS UI dev 端口由 **5173 改为 5180**（5173/5174/5175 被 MDM 项目 vite 占用，
> 见《基座对接操作手册.md》§5.8）；身份类型清单已扩展 TRUSTED/PORTAL（见《项目一体化同步方案.md》）。
> 涉及工程：
> - 子应用：`D:\workspaces\code\dolphinscheduler\dolphinscheduler-ui`（Vue 3 + Vite 3 + naive-ui + pinia + vue-router 4）
> - 基座：`D:\workspaces\code\dataops\dataops-frontend\dlite-front-main`（React 16 + qiankun ^2.0.24 + webpack 4）
> - 对接规范：《QIANKUN_VUE_INTEGRATION_GUIDE.md》（dataops-frontend 仓库根目录）

## 0. 已确认的决策

| 项 | 决策 |
|---|---|
| 注册名 / activeRule | `dolphinscheduler` / `/dolphinscheduler`（注册名 = 子应用 package.json `name`，需改名） |
| 构建工具 | 保留 Vite 3，使用 `vite-plugin-qiankun@1.0.15`（peerDeps: vite >= 2） |
| 集成深度 | 两阶段：一阶段功能页接入，二阶段统一鉴权 |
| 主应用改动 | 允许修改 `config_dev.json` 与 webpack dev 代理 |
| 方案文档位置 | 本目录（`海豚子插件/`） |

## 1. 总体架构与数据流

```
浏览器 http://localhost:2024
└─ dlite-front-main（qiankun host，:2024）
   ├─ 注册表 static/main/config_dev.json 追加 dolphinscheduler 项
   │    entry: http://localhost:5173  activeRule: /dolphinscheduler  container: #app-container
   ├─ 内容区 #app-container ← qiankun 注入子应用（子应用根节点 #dolphinscheduler-root）
   └─ dev 代理 /dolphinscheduler → http://127.0.0.1:12345（DS 后端 API）
        ▲ 子应用 XHR（baseURL=/dolphinscheduler，同域 :2024 发起）
   │
   └─ 子应用 dolphinscheduler-ui（Vite dev :5173，entry 被 qiankun 跨域 fetch，需 CORS 头）
        └─ 独立运行兼容：http://127.0.0.1:5173/ 直连（不经过基座）
```

要点：

- qiankun 按 `activeRule` 前缀 `/dolphinscheduler` 激活子应用，从 `entry` 拉取 HTML；Vite dev 必须返回 CORS 头，否则 entry 拉取被拦。
- 子应用在基座内的 API 请求发往同域 `:2024`，由基座 dev 代理转发到 DS 后端 `:12345`（与 DS UI 自带 dev 代理规则一致：`/dolphinscheduler` → `VITE_APP_DEV_WEB_URL`，无 pathRewrite，DS API 本身带 `/dolphinscheduler` context path）。
- 浏览器地址栏 URL 归基座所有；子应用 Vue Router 以 `/dolphinscheduler` 为 base，只做视图切换。

## 2. 阶段一：功能页接入

### 2.1 子应用改造（dolphinscheduler-ui）

**① `package.json`**
- `name`: `dolphinscheduler-ui` → `dolphinscheduler`（qiankun 按注册名从 UMD 库取生命周期，必须一致）。
- 新增依赖：`vite-plugin-qiankun@1.0.15`（devDependencies）。
- **必须加依赖固定**（已在隔离环境实测，不加会在 Node 16 下直接崩溃）：
  ```json
  "pnpm": { "overrides": { "cheerio": "1.0.0-rc.10" } }
  ```
  原因：插件依赖声明为 `cheerio ^1.0.0-rc.10`，npm/pnpm 会解析到 cheerio@1.2.0，其传递依赖 undici@7 需要 Node 18 的全局 ReadableStream，Node 16 下 vite 加载插件即抛 `ReadableStream is not defined`。
- 影响面核对：UI 模块由 frontend-maven-plugin 构建，不引用 package name；pnpm 安装以目录为准，改名无影响。

**② `vite.config.ts`**
- 引入插件：`qiankun('dolphinscheduler', { useDevMode: true })` 加入 plugins（放在 vue() 之后）。
- `server.headers` 增加 CORS 头（qiankun 跨域 fetch entry 必需）：
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
  Access-Control-Allow-Headers: X-Requested-With, content-type, Authorization
  ```
- `base` 保持现状（dev `/`、prod `/dolphinscheduler/ui/`），qiankun 模式下运行时 publicPath 由插件经 `window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__` 注入，无需手写 webpack 式 public-path.js。
- 注意：`useDevMode: true` 是插件 README 要求的子应用调试模式（与 HMR 客户端冲突，插件会重写 entry HTML 绕过 /@vite/client）；vue() 插件保留、SFC 编译正常，仅基座内加载时无热更新，独立开发不受影响。

**③ `index.html`**
- 挂载点 `<div id="app">` → `<div id="dolphinscheduler-root">`（全仓库仅 `index.html` 与 `main.ts:41` 两处引用 `#app`，已核实）。
- 禁止用 `#app` 的原因：与基座等应用挂载点命名冲突风险，遵循指南约定。

**④ `src/main.ts`（入口改造为生命周期导出）**

```ts
import { createApp, App } from 'vue'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
// ... 现有 i18n/echarts 等组装逻辑抽成 render(props)

let instance: App | null = null
function render(props: any = {}) {
  const container = props.container
    ? props.container.querySelector('#dolphinscheduler-root')
    : '#dolphinscheduler-root'
  instance = createApp(App)
  instance.use(router); instance.use(pinia); instance.use(i18n)
  instance.mount(container)
  bindQiankun(props)   // 见 2.3，订阅全局状态
}

renderWithQiankun({
  bootstrap: async () => {},
  mount: async (props: any) => render(props),
  unmount: async () => {
    instance?.unmount(); instance = null
    // 清理 window 上子应用挂的全局变量（$message 等，见 2.4 沙箱风险）
  },
  update: async () => {}   // 类型必填，no-op
})

if (!qiankunWindow.__POWERED_BY_QIANKUN__) render()   // 独立运行入口
```

注意点：
- **类型**：helper 自带声明（`dist/helper.d.ts`），无需手写 declare module；但 `QiankunLifeCycle` 类型中 `update` 为必填字段，需补 no-op。
- **无沙盒**：该插件方案下微应用**不运行在 qiankun 的 JS 沙盒中**（插件 README 明示），入口经 ESM 直跑；`unmount` 清理与 window 变量操作必须显式处理（见 2.4）。
- pinia/i18n/echarts 等插件注册保持现状，随 render 重新实例化。

**⑤ `src/router/index.ts`（路由 base 适配）**

现状（第 33-35 行）：`createWebHistory(import.meta.env.MODE === 'production' ? '/dolphinscheduler/ui/' : '/')`。

改为三态：

```ts
const base = qiankunWindow.__POWERED_BY_QIANKUN__
  ? '/dolphinscheduler'                    // 基座内
  : import.meta.env.MODE === 'production'
    ? '/dolphinscheduler/ui/'              // 独立部署（生产）
    : '/'                                  // 独立开发
```

- 基座内子应用内部跳转（`router.push`）只同步自身视图；vue-router base 已保证 push 的路径落在 `/dolphinscheduler` 前缀下，activeRule 持续命中，不会触发应用切换。
- `service.ts:70` 的 401 跳转 `router.push({ path: '/login' })` 在 base 适配后自动变为 `/dolphinscheduler/login`，无需改。
- 跨应用跳转（本期无此需求）：后续如需"去数据开发"类跳转，一律走 `window.__qiankun_props__.routerChange(目标路由, 参数, 产品名)`，禁止直接 pushState。

**⑥ `src/qiankun/useQiankunState.ts`（新增，全局状态订阅）**

```ts
// mount 时调用 bindQiankun(props)，onGlobalStateChange(cb, true) 立即拿快照
// - window.__qiankun_props__ = value（全工程统一入口，跨应用跳转/返回时读取）
// - value.language → localesStore.setLocales()
// - value.theme（1 浅 / 2 深）→ themeStore.darkTheme = theme === 2
//   （themeStore 现有 setDarkTheme 是取反切换，需补一个可设值的 action，如 setDarkThemeFlag(flag: boolean)）
// - value.user / value.project → 阶段二使用
// - value.logout === true → 阶段二：清 userStore、跳登录兜底
```

### 2.2 基座改造（dlite-front-main）

**① `static/main/config_dev.json`** — `apps` 数组追加：

```json
{ "name": "dolphinscheduler", "entry": "http://localhost:5180", "container": "#app-container", "activeRule": "/dolphinscheduler" }
```

（`QiankunRegist.js:14-25` 会自动补 `props.publicPath/questUrl = entry`，无需手工加。）

**② `config/webpack.dev.config.js`** — `proxy` 数组追加：

```js
{
  context: ['/dolphinscheduler'],
  changeOrigin: true,
  target: 'http://127.0.0.1:12345'   // DS 后端（Standalone Server / API Server）
}
```

无 pathRewrite（DS API 自带 `/dolphinscheduler` context path），规则与 DS UI 自带 dev 代理一致。生产环境由网关将 `/dolphinscheduler` 分发到 DS 后端，生产 `config.json` 的 entry 改为同域路径（如 `/dolphinscheduler-ui/`），本期只改 dev。

### 2.3 语言/主题联动（验收项）

- 基座下发 `language`（`zh_CN`/`en_US`）→ `useQiankunState` 写入 localesStore；App.tsx 的 NConfigProvider locale 与 i18n 已随 store 响应式切换（现状已支持，只需状态接通）。
- 基座下发 `theme`（1 浅 / 2 深）→ 写 themeStore.darkTheme → App.tsx `darkTheme` computed 切换 naive-ui 暗黑主题。基座自定义主题色通过全局 CSS 变量注入，naive-ui 组件用主题变量渲染，视觉基本跟随；精细对齐留作优化项。

### 2.4 风险与对策

| 风险 | 实测/对策 |
|---|---|
| ~~vite-plugin-qiankun × Vite 3 兼容性未知~~ **已实测** | Node 16.20.2 + Vite 3.2.7 + 插件 1.0.15 验证通过：dev server 正常启动，entry HTML 被正确重写（暴露 `window['dolphinscheduler']` 生命周期、`window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__` 注入、保留 `#dolphinscheduler-root` 挂载点），CORS 头生效。唯一前提是固定 cheerio（见 2.1①） |
| cheerio 传递依赖 undici@7 导致 Node 16 崩溃 | 已在隔离环境实测复现并验证修复：package.json 加 `pnpm.overrides`/`overrides` 固定 `cheerio@1.0.0-rc.10` |
| **无 JS 沙盒**（插件 README 明示：微应用不运行在 qiankun JS 沙箱中） | 子应用对 window 的读写直接作用于基座。已全量核实 DS UI 挂 window 的点：仅 `window.$message` 一处，赋值点在 `layouts/content/index.tsx:31` 与 `views/login/index.tsx:49`（useMessage 实例），消费点 49 处。对策：赋值处改用 `qiankunWindow.$message`；`unmount` 中 `delete window.$message`（重新进入时会重新赋值，无残留风险）；验收时重点检查与基座互切后的异常 |
| 子应用弹窗/样式污染基座（指南 4.11 踩坑区） | naive-ui 的 n-message/n-dialog 默认挂 body；本期先观察，若出现污染再加 prefix class 或 teleport 容器配置 |
| `position: fixed` 布局在主应用内偏移 | DS UI 现有布局为常规文档流 + 100vh，风险低；验收时重点看登录页与 DAG 画布 |
| 静态资源 404（publicPath 未注入） | 插件已注入运行时 publicPath（实测 entry HTML 中含注入逻辑）；验证点：基座内加载时 favicon/字体/懒加载 chunk 正常 |
| `#app` 改名遗漏 | 已全仓库 grep，仅 2 处引用 |
| HMR | 基座内加载无热更新（useDevMode 要求），独立开发不受影响；实施联调时改动子应用代码需刷新页面验证 |
| 基座 dev 代理顺序 | `/dolphinscheduler` 代理与基座自身路由不冲突（基座路由无此前缀）；注意放在 proxy 数组中先于 historyApiFallback 生效（webpack-dev-server 默认行为，无需额外配置） |

## 3. 阶段二：统一鉴权对接（设计，后端改造不在本期实施）

### 3.1 两侧机制调研结论

**基座 dlite-front-main**：

| 项 | 机制 | 出处 |
|---|---|---|
| 登录 | 本地账密 + 验证码 `POST /dlite-portal/sign/login`（密码 AES-128-ECB 加密传输）；另有定制 SSO（identity.syncotechai.com 回跳种 cookie） | `src/pages/login/index.jsx:147`、`src/util/Utils.js:335` |
| 凭证 | **Cookie-Session**：`sessionId` Cookie（JS 可读）；用户对象缓存 localStorage key=`${sessionId}-${product}main` | `src/util/StorageUtil.js:6,14` |
| 请求带凭证 | 同域 Cookie 自动携带，不加 Authorization；统一头 `X-Requested-With: XMLHttpRequest` | `src/util/Request.js:42,46-62` |
| 401 处理 | code=`999999`/`401` → `localStorage.clear()` + 跳 `/login` 或 SSO 登出重定向 | `src/util/Request.js:65-91` |
| 用户下发 | `POST /dlite-portal/oauth/token/getUser` → qiankun 全局状态 `user`（字段：id/name/comment/type/tenantId/tenantName） | `pages/main/index.jsx:65-79,399-417,662-671` |
| 登出广播 | `setGlobalState({logout:true})` 后清本地 | `pages/main/index.jsx:807-818` |
| LDAP | 无 | — |

**DolphinScheduler**：

| 项 | 机制 | 出处 |
|---|---|---|
| 登录 | `POST /dolphinscheduler/login` `{userName, userPassword}`（明文，无盐 MD5 与库中比对）；支持 LDAP / Casdoor SSO / OAuth2 多 provider | `LoginController.java:109-142`、`PasswordAuthenticator.java:26-28` |
| 会话 | **DB 表 `t_ds_session`**（每用户 1 条，**7200s 硬过期、不续期**）；校验拦截器 `LoginHandlerInterceptor`：优先 header `sessionId`，否则 Cookie | `SessionServiceImpl.java:59-93`、`LoginHandlerInterceptor.java:64-96` |
| 免密通道 | ① header `token`（`t_ds_access_token`，API 令牌，带过期时间）可绕过 session；② OAuth2 code 换 token 再换 session，302 回跳 `callbackUrl?sessionId=xxx` | `LoginHandlerInterceptor.java:68-85`、`LoginController.java:208-251` |
| 扩展点 | `Authenticator` SPI（`security/Authenticator.java`），`SecurityConfig.java:59-78` 按 `security.authentication.type` 装配：PASSWORD / LDAP / CASDOOR_SSO | `security/` 包 |
| 前端登录态 | sessionId 存 pinia userStore（localStorage 键 `user`）+ Cookie `sessionId`；请求头统一带 `sessionId`；401 → 清 store 跳 `/login`；退出 `POST /signOut` | `src/service/service.ts:76-83`、`use-login.ts:41-58` |

### 3.2 推荐方案：可信来源免密换取 DS Session（Trusted Authenticator）

**核心思路**：基座与 DS 后端之间建立信任通道（同域网关 + 仅内网可达），DS 后端新增一种认证类型，信任网关转发的用户标识，为该用户自动签发 DS session；子应用 UI 在 qiankun mount 时静默完成换取，用户无感知。

**时序**：

```
1. 用户在基座已登录，进入 /dolphinscheduler/*
2. 子应用 mount → bindQiankun 拿到基座 user（user.name 即登录名）
3. 若 userStore.sessionId 为空：
   POST /dolphinscheduler/login        （security.authentication.type=TRUSTED）
   参数：{ userName: <基座登录名>, userPassword: <占位/空> }
4. DS 后端 TrustedAuthenticator：
   - 校验请求来自可信来源（网关注入头，如 X-Forwarded-User / 内网白名单）
   - 按登录名查/建 DS 本地用户（参考 CasdoorAuthenticator 自动建用户逻辑）
   - createSessionIfAbsent → 返回 sessionId
5. 前端拿到 sessionId → 写 userStore + Cookie（复用 use-login 现有逻辑）
6. 后续业务请求走既有 sessionId header 机制，零改动
```

**后端改动（依赖项，不在本期实施，仅设计）**：
- `AuthenticationType` 增加 `TRUSTED`；新增 `TrustedAuthenticator extends AbstractAuthenticator`；`SecurityConfig` 加装配分支。

**前端改动（本期可独立完成部分）**：
- 新增 `src/qiankun/useTrustedLogin.ts`：mount 后 sessionId 为空时自动调 `/login` 换取；失败兜底显示 DS 登录页（保留现有登录页作为降级通道）。
- 隐藏 DS 登录页入口逻辑：仅在换取失败时渲染。
- 监听全局状态 `logout:true` → 清 userStore + 调 `/signOut`。
- 401 处理保持现状（跳 DS 登录页兜底），或按联调结果改为通知基座跳统一登录。

### 3.3 备选方案（对比，供决策）

| 方案 | 说明 | 代价 |
|---|---|---|
| B. AccessToken 通道 | 基座管理面为每个用户预生成 DS API Token（`t_ds_access_token`），子应用请求头带 `token` |  token 生命周期管理（创建/过期续期）；DS 会话类接口（依赖 session 的）可能不完整；仍需同步用户 |
| C. 标准 OAuth2 Provider | DS 侧已支持 OAuth2 多 provider，把基座 IdP 配成一个 provider | 基座 SSO 是定制 IdP（identity.syncotechai.com），非标准 OIDC，改造在基座侧，不可控 |

### 3.4 方案 C 详解：标准 OAuth2 Provider 对接（备选方案展开）

#### 3.4.1 DS 侧 OAuth2 机制现状（源码已核实）

**配置模型**（`OAuth2Configuration.java:32-52`，开关 `@ConditionalOnProperty security.authentication.oauth2.enable`）：

```yaml
security:
  authentication:
    oauth2:
      enable: true
      provider:
        <providerName>:
          authorizationUri: <IdP 授权端点>
          tokenUri: <IdP code 换 token 端点>
          userInfoUri: <IdP 用户信息端点>
          clientId / clientSecret: <IdP 颁发的应用凭证>
          redirectUri: <DS 后端回调地址，浏览器可达>
          callbackUrl: <登录成功后 302 回跳的前端地址>
          provider: <名称>          iconUri: <登录页图标>
```

支持多 provider（自带 github/gitee 示例，`application.yaml:122-144`）。

**后端流程**（`LoginController.java`）：

1. `GET /oauth2-provider`（:188-206）：向前端下发 provider 列表（authorizationUri/redirectUri/clientId/provider/iconUri，**不下发 secret**）；该路径在登录拦截器豁免清单中。
2. `GET /redirect/login/oauth2?code=&provider=`（:210-251，同样在豁免清单）：
   - POST `tokenUri`（`client_secret` 走 body，`client_id/code/grant_type=authorization_code/redirect_uri` 走 query）换 `access_token`（:216-228）；
   - GET `userInfoUri`（`Authorization: Bearer` + `access_token` query）取用户信息，**硬编码解析 `"login"` 字段作为用户名**（:236）；
   - 用户不存在则自动创建（`GENERAL_USER`，密码 null，:237-240）；
   - `createSessionIfAbsent` 签发 DS session，302 回跳 `callbackUrl?sessionId=xxx&authType=oauth2`（:241-244）；失败则 302 回跳 `callbackUrl?authType=oauth2&error=...`（:245-249）。

**前端流程**（`use-login.ts`）：

- 登录页从 `/oauth2-provider` 拉取列表渲染第三方登录按钮；
- `gotoOAuth2Page`（:75-80）：整页跳 `authorizationUri?client_id=..&response_type=code&redirect_uri=<redirectUri>?provider=<名>`；
- `handleRedirect`（:82-99）：登录视图检测到 `?authType=oauth2&sessionId=xxx` 后写 Cookie、拉 getUserInfo 写 store、跳 home。
- 现有怪癖（不影响可用性）：`handleRedirect` 只写了 Cookie **没写 `userStore.sessionId`**，之后请求依赖"后端 header 为空时回退读 Cookie"（`AbstractAuthenticator.getAuthUser`）——接入时建议顺手补上 store 写入。

#### 3.4.2 接入基座的设计

**前提（核心外部依赖）**：基座 IdP（identity.syncotechai.com / datamind admin 服务）需暴露标准 OAuth2 三端点：authorize、token、userinfo。**基座现状是定制 SSO（URL 回跳种 cookie），无 authorize/code 流程**——需基座团队确认或改造，这是本方案可行性开关。

**配置（纯配置，DS 后端零代码）**：在 DS `application.yaml` 增加 provider `dlite`：

| 字段 | 开发环境值 | 说明 |
|---|---|---|
| authorizationUri/tokenUri/userInfoUri | 基座 IdP 端点 | 由基座团队提供 |
| redirectUri | `http://localhost:2024/dolphinscheduler/redirect/login/oauth2` | 经基座代理到 :12345，浏览器可达即可 |
| callbackUrl | `http://localhost:2024/dolphinscheduler/login` | 落在基座地址，由子应用登录视图接管解析 |
| clientId/clientSecret | IdP 注册颁发 | 需在 IdP 注册应用并配置 redirect_uri 白名单 |

**qiankun 内时序**：

```
1. 子应用 mount 且无 DS session → 顶层 window 整页跳 authorize
   （复用 gotoOAuth2Page；用户在 IdP 已有 SSO 会话则免交互直接回跳）
2. IdP → redirectUri（经基座代理 → DS 后端 /redirect/login/oauth2）
   → code 换 token → userinfo 取用户名 → 自动建用户 → 建 DS session
   → 302 callbackUrl?sessionId=xxx&authType=oauth2
3. 浏览器回到基座 /dolphinscheduler/login?... → 子应用登录视图
   handleRedirect 解析 sessionId 写入 store/Cookie → getUserInfo → 跳 home
4. 之后业务请求走既有 sessionId/Cookie 机制，零改动
```

**会话续期（相对推荐方案的优点）**：DS session 7200s 硬过期后接口 401 → 子应用重新触发 OAuth2 跳转 → IdP 会话通常仍有效 → 无感续期，无需用户重新登录。

#### 3.4.3 需后端/IdP 配合的改造点

| # | 改造点 | 位置 | 性质 |
|---|---|---|---|
| 1 | IdP 暴露标准 OAuth2 authorize/token/userinfo 端点 | 基座侧（两仓库之外） | **可行性开关**，必须先确认 |
| 2 | userinfo 用户名字段硬编码 `"login"` | `LoginController.java:236` | 若 IdP 返回 `username`/`preferred_username` 需小改，建议做成可配置字段 |
| 3 | 回调无 `state` 参数校验（对比 Casdoor 实现有 state 防 CSRF） | `LoginController.loginByAuth2` | 建议小改补 state，消除登录 CSRF 风险 |
| 4 | `handleRedirect` 未写 `userStore.sessionId` | `use-login.ts:82-99` | 前端小改（本仓库可独立实施） |
| 5 | IdP 应用注册（clientId/secret、redirect_uri 白名单） | 基座/IdP 管理面 | 配置项 |

#### 3.4.4 与推荐方案（Trusted Authenticator）对比小结

- **优点**：DS 后端零新增代码（纯配置接入，若 IdP 已标准化则成本全场最低）；过期无感续期体验好。
- **缺点**：强依赖基座 IdP 标准化——现状不满足，改造在两仓库之外、进度不可控；每次续期多一次整页跳转+基座重载（有闪屏）；链路涉及 3 个系统（浏览器/IdP/DS），联调排错成本高。
- **结论**：维持 **Trusted Authenticator 为首选**。若基座团队确认 IdP 可暴露标准端点，本方案因"零后端代码"反而成为最优解——决策取决于对基座 IdP 的一次确认。

### 3.5 统一鉴权验收标准（对应 goal）

- 从基座进入子应用，无需出现 DS 登录页（换取失败除外，此时应可见降级登录页）。
- DS 后端接口以当前基座用户身份正常调用（按用户名自动建/匹配 DS 用户）。
- 基座登出后子应用同步清理，再进入需重新换取。

### 3.6 阶段二 UI 侧实施记录（已完成，开关默认关闭）

已落地代码（`dolphinscheduler-ui`，均在 `src/qiankun/` 与 `src/service/service.ts`）：

- `trustedLoginState.ts`：开关与运行时状态。`enabled=false`（**需后端部署 TRUSTED 认证后置 true**），此前所有行为与阶段一完全一致。
- `useTrustedLogin.ts`：静默换取——mount 后经基座全局状态拿到 `user.name`，以 `{userName, userPassword:''}` 调 `POST /dolphinscheduler/login`（裸 axios 实例，绕开业务拦截器的错误提示）；成功则复刻 `use-login` 的写 store/Cookie/getUserInfo 流程，失败静默兜底到 DS 登录页；换取进行中 `service.ts` 的 401 跳转被挂起，结局统一由本模块兜底。
- `useQiankunState.ts`：新增 `logout:true` 处理（清 userStore/Cookie + 调 `/signOut` + 重置换取状态）；收到 `user` 时触发静默换取。
- `service.ts` 401 分支：换取进行中挂起跳转；`enabled && succeeded && qiankun` 时 401/504 跳基座统一登录（`window.location.href='/login'`）；否则维持 DS 登录页兜底。

**实施踩坑（重要）**：`@/service/*` 模块在**模块求值期**就 `useUserStore()` 实例化（依赖 active pinia）。`useQiankunState.ts` 若静态 import service 模块，会把它们拉进首屏模块图、在 `app.use(pinia)` 之前求值 → 全局报 `getActivePinia() was called but there was no active Pinia`、子应用白屏。解法：service 相关 import 全部改为**回调内动态 import**。

**剩余依赖（后端，不在本期实施）**：`AuthenticationType.TRUSTED` + `TrustedAuthenticator`（信任网关注入用户标识、自动建用户、签发 session）落地后，将 `trustedLoginState.enabled` 置 `true` 即完成统一鉴权切换。

### 3.7 后端开发任务清单（TRUSTED 认证，**已实施完成**，联调验证见 6.6）

> 涉及仓库：`dolphinscheduler`（dolphinscheduler-api 模块）。以下 7 项已全部落地（用户指示扩大边界后实施）：

| # | 任务 | 位置 | 状态 |
|---|---|---|---|
| 1 | `AuthenticationType` 新增 `TRUSTED` | `api/security/AuthenticationType.java` | ✅ `TRUSTED(3, "verify via trusted gateway header")` |
| 2 | `TrustedAuthenticator extends AbstractAuthenticator` | `api/security/impl/trusted/TrustedAuthenticator.java` | ✅ `login()`：查用户→不存在自动创建（GENERAL_USER）→返回；session 创建由基类 `authenticate()` 完成 |
| 3 | `SecurityConfig` 装配分支 | `api/security/SecurityConfig.java` | ✅ TRUSTED 分支 + 独立 `trustedAuthenticator` Bean（不影响全局密码认证） |
| 4 | **独立登录端点** `POST /login/trusted` | `api/controller/LoginController.java` | ✅ 信任源检查（`X-Trusted-Client` 共享密钥、常量时间比较、空密钥即拒绝）→ 换 session → 写 httpOnly Cookie；`/login/**` 本就在拦截器豁免清单 |
| 5 | 配置项 | `standalone-server application.yaml` | ✅ `security.authentication.trusted.enable=true` + dev 密钥（生产须部署注入） |
| 6 | 前端配套 | `useTrustedLogin.ts` / `trustedLoginState.ts` | ✅ 改调 `/login/trusted`（只传 userName），`enabled=true` |
| 7 | 联调验收 | — | ✅ 全部通过（见 3.5 结果与 6.6 记录） |

**实施期补充设计**（相对原清单的演进）：密钥头由**基座 dev 代理按路径注入**（`onProxyReq` 仅对 `/login/trusted` 加 `X-Trusted-Client`，模拟生产网关；其余 API 请求不带密钥，防止借基座冒领任意账号会话）。

**安全红线**（保持有效）：TRUSTED 端点必须只对内网/网关可达；`X-Forwarded-User`/`X-Trusted-Client` 类头必须以网关注入为准、不接受客户端直接传入（当前实现：密钥不匹配即返回 10043，密钥为空配置时一律拒绝）。

## 4. 实施步骤拆解（阶段一）

| # | 任务 | 产出/验证 |
|---|---|---|
| 1 | 子应用：package.json 改名 + 装 vite-plugin-qiankun + 固定 cheerio | `pnpm install` 通过，dev server 能启动 |
| 2 | 子应用：vite.config.ts（插件 + CORS 头） | 独立运行 `pnpm run dev` 正常（回归） |
| 3 | 子应用：index.html 挂载点 + main.ts 生命周期 + useQiankunState | 独立运行正常；`pnpm run build:prod` 编译通过（vue-tsc） |
| 4 | 子应用：router base 三态适配 | 独立运行回归 |
| 5 | 基座：config_dev.json 注册 + dev 代理 | 重启基座生效 |
| 6 | 联调验证（见第 5 章清单） | 逐项打勾 |

## 5. 验收清单（阶段一）

| # | 项 | 通过标准 |
|---|---|---|
| 1 | 独立运行回归 | `http://127.0.0.1:5173` 直连，登录页/首页/各功能页正常 |
| 2 | 集成加载 | 基座 `:2024` + 子应用 `:5173`，访问 `http://localhost:2024/dolphinscheduler/home`，子应用渲染在内容区，无"子应用加载失败" |
| 3 | 功能页浏览 | 项目管理/资源/数据质量/监控/安全/界面设置 各页渲染正常，子应用内路由切换正常 |
| 4 | 语言联动 | 基座切换语言，子应用 UI 文案与 naive-ui 组件语言响应式更新 |
| 5 | 主题联动 | 基座切深色，子应用切换 dark theme |
| 6 | 接口代理 | 经基座 `curl http://localhost:2024/dolphinscheduler/...` 非 502/404（若 :12345 未启动则标记待联调，代理规则经静态核对） |
| 7 | 卸载 | 基座内反复切换菜单进出本子应用，无重复挂载异常 |
| 8 | 编译 | `pnpm run build:prod` 通过（防 TS 报错进主干） |

## 6. 附录

### 6.1 可行性验证记录（已完成）

在隔离目录（非两个真实仓库）用 Node 16.20.2 + Vite 3.2.7 + @vitejs/plugin-vue@3.2.0 + vite-plugin-qiankun@1.0.15 实测：

- ✅ dev server 正常启动，`vue() + qiankun(name, {useDevMode:true})` 共存无冲突；
- ✅ entry HTML 被插件重写：注入 `window['dolphinscheduler'] = {bootstrap, mount, unmount, update}`（qiankun 按注册名取生命周期的挂点）、`window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__` 运行时 publicPath、保留 `<div id="dolphinscheduler-root">`；
- ✅ CORS 响应头生效；
- ✅ 入口 main.ts 经 Vite 正常转换（helper 以预打包 deps 引入）；
- ❌→✅ 未固定 cheerio 时 `vite.config.ts` 加载即抛 `ReadableStream is not defined`（undici@7 × Node 16），加 overrides 固定 `cheerio@1.0.0-rc.10` 后修复。

### 6.2 改动文件清单预览（实施终态）

**dolphinscheduler-ui**：`package.json`（改名+插件+pnpm.overrides 固定 cheerio）、`vite.config.ts`、`index.html`、`src/main.ts`、`src/router/index.ts`、新增 `src/qiankun/`（useQiankunState.ts / useTrustedLogin.ts / trustedLoginState.ts）、`src/store/theme/theme.ts`（补 setDarkThemeFlag）、`src/service/service.ts`（401 三态）、另含前期修复 `src/router/modules/ui-setting.ts`（上游同名路由 bug）。

**dlite-front-main**：`static/main/config_dev.json`、`config/webpack.dev.config.js`（代理 + bypass）、`src/pages/main/index.jsx`（3 处补丁，见 6.3）。

### 6.3 实施期基座侧新增补丁（联调实证后追加，均已生效）

1. **`config/webpack.dev.config.js` 代理加 `bypass`**：activeRule `/dolphinscheduler` 与 DS API 前缀同名，浏览器页面导航（`Accept: text/html`）会被代理到 DS 后端导致基座白屏。`bypass` 对 html 请求返回 `'/index.html'` 交给基座自身服务（注意：HPM 0.19 中 bypass 返回 `false` 不是"回退本地"语义，实测会让该请求 404；且此修复让基座全部深链直访全局可用——原本任何路由直访都 404）。XHR（Accept 为 json/plain）仍正常代理到 :12345。
2. **`pages/main/index.jsx setTopDefaultMenu`**：路径未命中后端菜单路由时原本直接 `push('/404')` 并 `return`（返回 undefined 导致解构崩溃）。新增：路径命中已注册 qiankun 子应用前缀（`GlobalData.__Conf__.apps` 的 activeRule）时回退到第一个顶部菜单，保证主框架与 `#app-container` 渲染，由 qiankun activeRule 挂载子应用。生产配好后端菜单后此回退不改变正常逻辑。
3. **`pages/main/index.jsx getCurSubMenu`**：`_curRouter` 为空时对 `_curRouter.leftMenu` 无守护（原逻辑到不了这步，补丁 2 使其可达），补空值守护。
4. **`pages/main/index.jsx loadApp`**：默认菜单流程会 `pushState` 把地址劫持到默认菜单页（实测把 /dolphinscheduler/home 抢走并尝试加载未运行的 integro）。新增：当前地址已处于某已注册 qiankun 前缀内、且目标菜单路由不属于该前缀时，保留当前地址仅下发全局状态。

**生产依赖（后端，不在本期实施）**：基座菜单（multiMenu）需配置 dolphinscheduler 产品菜单项，`pageRefType=3`、`router` 以 `/dolphinscheduler` 开头，子应用入口才会出现在基座导航中；生产网关需把 `/dolphinscheduler` 按规则分流（页面 → 基座，API → DS 后端）。

**不做**：git commit；后端（dolphinscheduler-api / Standalone Server / dlite-portal）改造；其他 7 个子应用；生产配置（config.json / 网关，待 dev 验收后另行处理）。

### 6.4 阶段一验收结论（实测记录）

| # | 项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 独立运行回归 | ✅ 通过 | `http://127.0.0.1:5173/home` 全菜单+任务/工作流实例统计带数据渲染 |
| 2 | 集成加载 | ✅ 通过 | `http://localhost:2024/dolphinscheduler/home` 子应用渲染于基座内容区，外壳/水印共存正常 |
| 3 | 功能页浏览/路由切换 | ✅ 通过 | 首页、项目管理、租户管理、监控中心渲染正常；子应用导航栏 SPA 切换（monitor→projects）无整页刷新 |
| 4 | 语言联动 | ⏸️ 延后验证（用户决策） | 全链路代码级确认（基座 dispatch `language` main/index.jsx:46 → onGlobalStateChange → localesStore → i18n/NConfigProvider），初始值两侧一致（zh_CN）。基座代码库无任何语言写入点（IntlPage.jsx 仅启动时读取），动态切换在本环境不可验；**用户指示暂不验证**，机制保持就绪 |
| 5 | 主题联动 | ⏸️ 延后验证（用户决策） | 同上（基座 dispatch `theme` :517 → setDarkThemeFlag → naive-ui darkTheme）；主题由后端配置启动加载，无用户切换入口；**用户指示暂不验证** |
| 6 | 接口代理 | ✅ 通过 | `curl POST :2024/dolphinscheduler/login` 实测 login success + sessionId Cookie |
| 7 | 卸载/重挂载 | ✅ 通过 | /portal 往返：子应用随主框架干净卸载，重挂载正常且免重登 |
| 8 | 编译 | ✅ 通过 | `pnpm run build:prod`（vue-tsc + vite build）exit 0，产物结构核对正常 |

**遗留决策项**（需基座/后端侧推进）：

1. #4/#5 动态验收：待基座提供语言/主题切换入口后补测（机制已就绪，预计一次通过）。
2. 生产接入：后端菜单（multiMenu）配置 dolphinscheduler 产品菜单（pageRefType=3）+ 网关分流规则（页面→基座、API→DS 后端）。
3. ~~阶段二后端：按 3.7 清单实施 TRUSTED 认证~~ **已完成并联调通过（见 6.6）**。
4. **DS 会话续期（已分析、暂缓实施，2026-11-18 决策）**：现状为固定 7200s 硬过期（`Constants.SESSION_TIME_OUT`，`SessionServiceImpl.java:97`），校验拦截器只读不写、业务请求不续期；但 `createSessionIfAbsent` 对仍有效的会话会重置 `last_login_time`（`:71-74`），即**重调 `/login/trusted` 即续期**（过期时会换发新 sessionId，前端须同步 store/Cookie）。后续可选方案：A. 前端续期（基座全局状态下发时节流重调换取 + 兜底定时器，零后端改动）；B. 后端滑动续期（校验通过后惰性刷新时间戳，需重建后端）；A+B 组合。基座过期联动已由「基座 401 跳登录 → 重新进入换取」链路覆盖。后续对接主应用鉴权模块时一并设计。

### 6.5 阶段二联调验收记录（统一鉴权，已完成）

| 验证项 | 结果 | 证据 |
|---|---|---|
| 后端信任逻辑 | ✅ | 直连无密钥头 → 10043；直连错误密钥 → 10043；直连正确密钥 → 成功；密钥比对为常量时间比较，空密钥配置一律拒绝 |
| 自动建用户 | ✅ | `superadmin`（基座用户）首次换取时自动注册为 DS `GENERAL_USER`（id=2），get-user-info 返回完整档案 |
| 免密进入（核心验收） | ✅ | 基座登录后访问 `/dolphinscheduler/home`：全程**无 DS 登录页**，首页直接渲染，DS 身份为 superadmin，统计 API 以其身份正常返回 |
| 登出后重进 | ✅ | DS 内「退出登录」（/signOut 失效服务端会话 + 清本地）→ 刷新页面 → 静默重新换取 → 自动从 `/login` 跳回 `/home` 渲染，全程无登录页 |
| 竞态健壮性 | ✅ | 修复后：携带旧/空会话的迟到 401 不再清空新会话、不再误跳（请求级 session 快照比对）；vue-tsc exit 0 |

### 6.6 编译/运行卡点复盘（四轮构建 + 三次启动）

**Maven 构建四轮三个卡点**（v4 成功配方：`-s 镜像settings -DskipUT=true -Dmaven.test.skip=true -Dspotless.check.skip=true -Djacoco.skip=true -Dmaven.javadoc.skip=true -Dmdep.analyze.skip=true`，8.5 分钟）：

1. v1 卡 18 分钟：默认本地仓库 `~/.m2` 近空 + Maven Central 访问极慢（jstack 见 20 线程卡 socketRead）→ 阿里云镜像。
2. v2 失败：项目 surefire 的 skip 绑定自定义参数 `skipUT`（CI 传 `-DskipUT=false`），`-Dmaven.test.skip` 无效 → 测试照跑；且 `RemoteLogHandlerTest`（云凭据）、`HttpUtilsTest`（外网）在本机必挂 → `-DskipUT=true`。
3. v3 卡 50 分钟：根 pom 绑定的 `maven-dependency-plugin analyze` 逐 jar 全量扫描（jstack 见主线程 `DefaultProjectDependencyAnalyzer`）→ `-Dmdep.analyze.skip=true`。

**Standalone 启动三次失败**：

1. `Argument list too long`：依赖类路径 66KB 超 Windows 命令行上限（JDK8 无 `@argfile`）→ 通配符类路径。
2. `找不到主类`：官方 `bin/start.sh` 的通配类路径中 Git Bash 传给 Windows java.exe 的是 POSIX 路径（且后台 shell 不展开 `${d%/}` 产生字面量）→ `pwd -W` 显式构造 `libs\xxx\*` Windows 类路径。
3. `Invalid initial heap size: -Xms4g`：`jvm_args_env.sh` 默认 4G 初始堆、本机空闲内存不足 → `JAVA_OPTS="-Xms512m -Xmx1536m"` 覆盖。

**环境注意**：用户真实本地仓库在 `D:\workspaces\develop\apache-maven-3.9.16\repository`（非 `~/.m2`）；`~/.m2` 中失败标记（`.lastUpdated`）会阻断解析，必要时 `install:install-file` 手工补装；TaskStop 只杀包装进程，Maven 的 Java 子进程需手动 taskkill。

### 6.7 构建前置核实清单（复盘追加：环境变量/配置应先核实）

四轮构建约 2 小时墙钟，根因均可由构建前约 10 分钟的核实避免：

| 轮次 | 耗时 | 根因（实证） | 前置核实手段 |
|---|---|---|---|
| v1 | ~18min 零产出 | jstack：20 线程卡 Maven Central socketRead；默认仓库 `~/.m2` 近空——实际 IDE 仓库 `D:\workspaces\develop\apache-maven-3.9.16\repository` 全量缓存却未被使用 | `mvn help:effective-settings` 比对 localRepository；curl 探活候选镜像 |
| v2 | 测试失败中断 | surefire skip 绑定自定义参数 `skipUT`（root pom 实证），`-Dmaven.test.skip` 无效；`RemoteLogHandlerTest`（云凭据）/`HttpUtilsTest`（外网）本机必挂 | grep 根 pom `<skip>` 绑定 |
| v3 | 卡 50min | 根 pom 绑定 `dependency:analyze` 全量 jar 扫描（jstack：`DefaultProjectDependencyAnalyzer`） | grep 根 pom plugin executions |
| v4 | **8.5min 成功** | 跳过 analyze/javadoc/UT | — |

**发起长构建前必做**：① `mvn help:effective-settings` 核实实际 localRepository/mirrors 并与工程主人的 IDE/CI 配置比对；② curl 探活候选仓库、选最快镜像配临时 settings；③ grep 根 pom 的 `<skip>` 绑定（项目自定义参数名优先于通用参数名）；④ grep 生命周期绑定的重型插件（dependency:analyze、javadoc、rat 等）并确认各自跳过参数；⑤ 先单模块试编译（`-q -pl <小模块> compile`）验证环境再全量；⑥ 记录构建进程父子关系，确保可整体终止（包装进程 + Java 子进程）。

### 6.8 首访首页永久 loading 修复记录（2026-11-19）

**现象**：首次登录基座切换到数据开发，DS 首页（任务/工作流实例状态统计）永久转圈，刷新后正常。

**根因（两缺陷叠加，均实证到行）**：

1. **时序竞态**：`src/main.ts` 原实现先 `app.mount()` 后 `bindQiankun()`，首页 `onMounted` 的统计请求必然在可信登录交换完成前发出（首次本地无会话 → 401）；`service.ts` 对交换窗口内/迟到 401 只静默 reject、无重放（`attempting`/`late-401` 两分支均如此），首屏数据缺失。
2. **组件缺陷**：`use-task-state.ts`/`use-process-state.ts` 的 loading 仅在 `.then` 复位、无错误分支，且 `if (loading) return` 防重入 guard 阻断后续重试 → 一次 reject 永久卡死。独立登录场景（进首页时 session 必然已存在）不触发，基座免登录首访暴露。

**修复**（OpenSpec change `2026-11-19-fix-first-visit-home-stuck`，qiankun-subapp 新增 2 条需求）：

- `main.ts`：`render` 返回挂载 Promise；`bindQiankun`/`installHostNavigation` 提前到 mount 之前；经 `props.getGlobalState?.()?.user?.name` 同步取基座用户名（基座 `initGlobalState` 实证注入），`await tryTrustedLogin` 完成后再 `mount`；失败/无用户名照常 mount 回落登录页。独立运行路径不触发交换、行为不变。
- `useTrustedLogin.ts`：增加在途去重（并发触发共享同一交换 Promise，防 mount 前置调用与全局状态回调重复交换）；`finally` 的 `/login` 回落仅在路由已启动（`currentRoute !== START_LOCATION`）时执行，避免挂载前触发路由副作用。
- `use-task-state.ts`/`use-process-state.ts`：请求链补 `.catch` 复位 loading 并返回空数据，消除「一次 reject 永久转圈」，失败后可经日期切换重查。

**回归**：独立运行 5173 刷新回归 ✅；`build:prod`（`vue-tsc --noEmit && vite build`）exit 0 ✅；vite dev 热更无编译错误 ✅。**冷路径（首登无会话）双环境实测通过**（2026-11-19）：外部隐私窗口 + 内置浏览器各跑一次，调试探针证据链一致：`pre-mount user=superadmin`（挂载前取到基座用户名）→ `exchange-begin` → `exchange-ok` 先于任何 401；Network 中 trusted→get-user-info→base-dir→define-user-count/task-state-count/process-state-count 全部 200；首页表格/图表一次渲染（内容全 0 与后端实测一致：当日无任务/工作流实例）。验收步骤：退出基座重新登录 → 首页点「数据开发」卡片 → 首页统计一次出数、无需刷新。

**实施期增补修正（第二轮实测暴露）**：

1. **`props.getGlobalState()` 实测取不到基座用户名**（首访探针记录 `pre-mount user=none`）：全局状态的下发走 `onGlobalStateChange` 回调（且其立即触发晚于同步的挂载流程）。修复：`useQiankunState` 导出 `firstBaseUser` Promise（首个含 user 的全局状态回调里解析），`main.ts` 以 3s 超时竞速等待，保证交换仍先于首屏渲染。
2. **子应用模块缓存陷阱（测试方法教训）**：子应用由 qiankun 从 `127.0.0.1:5173` 独立源加载，只清基座页 `localhost:2024` 的站点数据**不会**清掉 5173 源的模块缓存，导致浏览器执行旧代码、修复「看起来无效」。验证时必须 F12→Network→Disable cache + 硬性重新加载（或同清 5173 源缓存）。
3. 临时诊断埋点（`debugMarker.ts` 及各处 dsDbg 调用）为定位上述问题引入，定位完成后已**全量清除**（grep 验证零残留）。
