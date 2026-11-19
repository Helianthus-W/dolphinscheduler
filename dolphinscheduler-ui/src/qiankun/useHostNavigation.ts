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

import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import type { Router } from 'vue-router'

const PREFIX = '/dolphinscheduler'

/**
 * qiankun host apps (dlite-front-main) drive navigation via
 * window.history.pushState(menu.router). React sub-apps respond because the
 * `history` package monkey-patches pushState; vue-router 4 does not, so under
 * qiankun we bridge host pushState calls into this app's router.
 *
 * Returns a cleanup function (restores the native pushState).
 */
export function installHostNavigation(router: Router): () => void {
  if (!qiankunWindow.__POWERED_BY_QIANKUN__) return () => {}

  const rawPushState = window.history.pushState
  let fromVueRouter = false

  const patched = function (
    this: History,
    data: any,
    unused: string,
    url?: string | URL | null
  ) {
    rawPushState.call(this, data, unused, url)
    if (fromVueRouter || typeof url !== 'string' || !url) return
    if (url.indexOf(PREFIX) !== 0) return
    const target = url.slice(PREFIX.length) || '/'
    if (target !== router.currentRoute.value.fullPath) {
      fromVueRouter = true
      Promise.resolve(router.replace(target)).finally(() => {
        fromVueRouter = false
      })
    }
  }

  window.history.pushState = patched as typeof window.history.pushState

  return () => {
    window.history.pushState = rawPushState
  }
}
