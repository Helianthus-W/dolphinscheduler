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

import axios from 'axios'
import qs from 'qs'
import cookies from 'js-cookie'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import { START_LOCATION } from 'vue-router'
import { useUserStore } from '@/store/user/user'
import { useTimezoneStore } from '@/store/timezone/timezone'
import { getUserInfo } from '@/service/modules/users'
import { queryBaseDir } from '@/service/modules/resources'
import { trustedLoginState } from './trustedLoginState'
import router from '@/router'

/**
 * Unified auth (phase 2): exchange the qiankun host user for a DolphinScheduler
 * session silently. Requires the TRUSTED authentication type on the DS backend;
 * until then this is a no-op and the DS login page remains the fallback.
 */
export function tryTrustedLogin(baseUserName?: string): Promise<void> {
  // In-flight dedupe: the pre-mount call and the global-state callback can
  // race; only one exchange may run at a time.
  if (!inFlightExchange) {
    inFlightExchange = doTryTrustedLogin(baseUserName).finally(() => {
      inFlightExchange = null
    })
  }
  return inFlightExchange
}

let inFlightExchange: Promise<void> | null = null

async function doTryTrustedLogin(baseUserName?: string) {
  // PORTAL 身份源下认证由基座逐请求完成，trusted 交换不适用；防御订阅期竞态
  if (trustedLoginState.portalMode) return
  if (!trustedLoginState.enabled || trustedLoginState.succeeded) return
  if (!qiankunWindow.__POWERED_BY_QIANKUN__ || !baseUserName) return
  const userStore = useUserStore()
  if (userStore.getSessionId) return

  trustedLoginState.attempting = true
  try {
    const res = await axios.post(
      '/dolphinscheduler/login/trusted',
      qs.stringify({ userName: baseUserName }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    const data = res.data && res.data.data
    if (res.data?.code === 0 && data?.sessionId) {
      await userStore.setSessionId(data.sessionId)
      await userStore.setSecurityConfigType(data.securityConfigType)
      cookies.set('sessionId', data.sessionId, { path: '/' })
      const userInfoRes = await getUserInfo()
      await userStore.setUserInfo(userInfoRes)
      await userStore.setBaseResDir(await queryBaseDir({ type: 'FILE' }))
      await userStore.setBaseUdfDir(await queryBaseDir({ type: 'UDF' }))
      await useTimezoneStore().setTimezone(
        userInfoRes.timeZone ? userInfoRes.timeZone : 'UTC'
      )
      trustedLoginState.succeeded = true
      if (router.currentRoute.value.path === '/login') {
        router.push({ path: 'home' })
      }
    }
  } catch (e) {
    // Exchange failed (e.g. TRUSTED auth not deployed): stay silent,
    // the DS login page handles the fallback.
  } finally {
    trustedLoginState.attempting = false
    if (
      trustedLoginState.portalMode &&
      !useUserStore().getSessionId &&
      router.currentRoute.value !== START_LOCATION &&
      router.currentRoute.value.path !== '/login'
    ) {
      // PORTAL 模式下没有 DS sessionId 属正常（认证走门户 cookie），不得因此跳登录页
      return
    }
    if (
      !useUserStore().getSessionId &&
      router.currentRoute.value !== START_LOCATION &&
      router.currentRoute.value.path !== '/login'
    ) {
      router.push({ path: '/login' })
    }
  }
}
