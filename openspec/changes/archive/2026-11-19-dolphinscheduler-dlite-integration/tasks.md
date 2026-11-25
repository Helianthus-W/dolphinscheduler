# Tasks

> 本 change 为回溯建档：所有任务已在 2026-11-17 ~ 2026-11-18 实施并联调通过，逐项标注实测证据出处（方案文档章节）。

- [x] 1. 子应用改造：package.json 改名 `dolphinscheduler` + vite-plugin-qiankun + pnpm 固定 cheerio（接入方案 2.1/6.1，build:prod exit 0 实测）
- [x] 2. 子应用入口：index.html 挂载点 `#dolphinscheduler-root`、main.ts 生命周期导出 + unmount 清理（接入方案 2.1）
- [x] 3. 子应用路由：base 三态（qiankun `/dolphinscheduler` / 独立生产 / 独立开发）（接入方案 2.1⑤）
- [x] 4. 基座注册：config_dev.json 追加应用项 + dev 代理 `/dolphinscheduler`→`:12345`（接入方案 2.2/6.3-1，登录经代理实测成功）
- [x] 5. 代理分流：bypass 按 Accept:text/html 把页面导航交基座（修复整页请求被代理到 DS 后端的白屏；注意 HPM 0.19 返回 false 不是回退语义）（菜单方案 6.3-1）
- [x] 6. 基座主框架补丁：未匹配路径 404→qiankun 前缀回退；getCurSubMenu 空值守护；loadApp 深链防劫持（接入方案 6.3-2/3/4）
- [x] 7. 后端 TRUSTED 认证：AuthenticationType.TRUSTED + TrustedAuthenticator + SecurityConfig 装配 + `POST /login/trusted`（常量时间密钥比对、空密钥拒绝）（接入方案 3.7，四项信任逻辑实测通过）
- [x] 8. 子应用统一鉴权：useTrustedLogin 静默换取（`/login/trusted`）+ 401 三态（含迟到 401 竞态修复：请求级 session 快照比对）+ logout 广播处理（接入方案 3.6/6.5，两次免登进入实测）
- [x] 9. 菜单 dev 等效 shim：portal 卡片 + top/children/allRoute/products 五处响应合并（菜单方案 4.x；shim 顶部菜单按 systemCode 作用域追加、products 全局追加）
- [x] 10. tab 作用域：product/sub_system_code 用 `dlite-dolphinscheduler`（dlite- 前缀触发基座 sub_system_code 过滤机制，与其他应用一致；未知 systemCode 后端调用失败由 appInitialRequest catch 兜底防白屏）（菜单方案 7.1-1）
- [x] 11. 子应用适配：qiankun 模式隐藏 DS 顶栏 + pushState→vue-router 桥接（重入守卫 + unmount 还原）（菜单方案 5，项目管理/监控中心切换实测）
- [x] 12. 菜单路径核对：8 个菜单项路径与 DS `router/modules/*.ts` 的 `path:` 字段逐一比对（修正资源中心 `/resource/file-manage` 单复数笔误）（菜单方案 7.1 延伸）
- [x] 13. 未知路径防御：海豚调度前缀未命中路由表 → 整页重定向 `/dolphinscheduler/home`（禁止重定向到 activeRule 前缀本身，会死循环）+ DS qiankun 模式 catch-all 404 提示路由（菜单方案 7.1-5，旧错误 URL 实测跳首页）
- [x] 14. 生产交付：后端菜单 DML（t_function_dict/t_function_language_rel/t_hot_url，基于 dataops-backend dlite-portal 源码核对）+ nginx 网关分流/密钥注入示例（菜单方案 6.1/6.2）
- [x] 15. 回归：build:prod exit 0、standalone 顶栏与数据正常、trusted 换取 curl 实测（菜单方案 7-5）
