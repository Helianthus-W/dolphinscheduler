/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ref } from 'vue'
import cookies from 'js-cookie'
import { useLocalesStore } from '@/store/locales/locales'
import { useThemeStore } from '@/store/theme/theme'
import { useUserStore } from '@/store/user/user'
import { trustedLoginState } from './trustedLoginState'

export const qiankunState = ref<Record<string, any>>({})

// Resolves with the first base user name delivered via global state, so the
// mount flow can await the trusted exchange before the first render even when
// props.getGlobalState is unavailable (resolves undefined after the caller's
// own timeout).
let resolveFirstBaseUser!: (name: string | undefined) => void
export const firstBaseUser = new Promise<string | undefined>((resolve) => {
  resolveFirstBaseUser = resolve
})

/**
 * Subscribe the global state dispatched from the qiankun host app.
 * Called in main.ts render() after pinia is installed.
 *
 * Note: services under `@/service/*` are imported dynamically on demand —
 * they instantiate stores at module level, which requires an active pinia
 * and must not run during the initial module graph evaluation.
 */
export function bindQiankun(props: Record<string, any> = {}) {
  if (props.onGlobalStateChange) {
    props.onGlobalStateChange((value: Record<string, any> = {}) => {
      ;(window as any).__qiankun_props__ = value
      qiankunState.value = value
      if (value.logout) {
        // Unified auth (phase 2): host logged out, clean up the DS session
        const userStore = useUserStore()
        userStore.setSessionId('')
        userStore.setSecurityConfigType('')
        userStore.setUserInfo({})
        userStore.setBaseResDir('')
        userStore.setBaseUdfDir('')
        cookies.remove('sessionId')
        trustedLoginState.succeeded = false
        import('@/service/modules/logout')
          .then((m) => m.logout())
          .catch(() => {})
        return
      }
      if (value.language) {
        const localesStore = useLocalesStore()
        localesStore.setLocales(value.language as 'zh_CN' | 'en_US')
      }
      if (value.theme) {
        const themeStore = useThemeStore()
        themeStore.setDarkThemeFlag(Number(value.theme) === 2)
      }
      // Unified auth (phase 2): silently exchange the host user for a DS session
      if (value.user) {
        resolveFirstBaseUser(value.user.name)
      }
      if (value.user && value.user.name) {
        import('./useTrustedLogin')
          .then((m) => m.tryTrustedLogin(value.user.name))
          .catch(() => {})
      }
    }, true)
  }
}

export function useQiankunState() {
  return qiankunState
}
