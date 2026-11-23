/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createApp, App as VueApp } from 'vue'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import App from './App'
import router from './router'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import i18n from '@/locales'
import * as echarts from 'echarts'
import 'echarts/theme/macarons'
import 'echarts/theme/dark-bold'
import './assets/styles/default.scss'
import trim from './utils/trim'
import { bindQiankun, firstBaseUser } from '@/qiankun/useQiankunState'
import { installHostNavigation } from '@/qiankun/useHostNavigation'
import { getAuthMode } from '@/qiankun/authMode'
import { trustedLoginState } from '@/qiankun/trustedLoginState'

let instance: VueApp | null = null
let hostNavigationCleanup: (() => void) | null = null

function render(props: Record<string, any> = {}) {
  const container = props.container
    ? props.container.querySelector('#dolphinscheduler-root')
    : '#dolphinscheduler-root'
  instance = createApp(App)
  const pinia = createPinia()

  pinia.use(piniaPluginPersistedstate)

  instance.config.globalProperties.echarts = echarts
  instance.config.globalProperties.trim = trim

  instance.use(router)
  instance.use(pinia)
  instance.use(i18n)

  bindQiankun(props)
  hostNavigationCleanup = installHostNavigation(router)

  return mountWhenTrustedReady(container, props)
}

/**
 * 可信登录先于首屏渲染：首访时子应用本地无 DS 会话，必须先完成交换再挂载，
 * 否则首页统计等首屏请求会在 sessionId 就绪前发出（401 被静默吞掉且组件
 * loading 不复位，页面永久转圈）。交换失败照常挂载，回落 DS 登录页兜底。
 */
async function mountWhenTrustedReady(
  container: Element | string,
  props: Record<string, any>
) {
  const mode = await getAuthMode()
  trustedLoginState.portalMode = mode === 'PORTAL'
  if (trustedLoginState.portalMode) {
    // 身份源=基座：认证由基座过滤器逐请求完成，子应用免换取、免 sessionId
    instance?.mount(container)
    return
  }
  // getGlobalState may be absent on mount props; fall back to awaiting the
  // first global-state emission (bounded), so the exchange still precedes
  // the first render.
  const fromState = props.getGlobalState?.()?.user?.name
  const baseUserName =
    fromState ??
    (await Promise.race([
      firstBaseUser,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000))
    ]))
  if (baseUserName) {
    try {
      const { tryTrustedLogin } = await import('@/qiankun/useTrustedLogin')
      await tryTrustedLogin(baseUserName)
    } catch (e) {
      // stay silent, the DS login page handles the fallback
    }
  }
  instance?.mount(container)
}

renderWithQiankun({
  bootstrap: async () => {},
  mount: async (props: Record<string, any>) => render(props),
  unmount: async () => {
    if (instance) {
      instance.unmount()
      instance = null
    }
    if (hostNavigationCleanup) {
      hostNavigationCleanup()
      hostNavigationCleanup = null
    }
    delete (window as any).$message
  },
  update: async () => {}
})

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}
