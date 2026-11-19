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

import {
  createRouter,
  createWebHistory,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router'
import { defineComponent, h } from 'vue'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import routes from './routes'
import { useUserStore } from '@/store/user/user'
import type { UserInfoRes } from '@/service/modules/users/types'

// NProgress
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// qiankun 模式下对未匹配路由给出明确提示（基座菜单直链失效/旧链接等场景），避免静默空白；
// 独立运行保持上游行为（无 404 页）
if (qiankunWindow.__POWERED_BY_QIANKUN__) {
  const RouteNotFound = defineComponent({
    name: 'RouteNotFound',
    setup() {
      return () =>
        h(
          'div',
          {
            style:
              'padding:48px 24px;text-align:center;color:#888;font-size:14px'
          },
          '页面不存在或链接已失效，请从左侧菜单重新进入'
        )
    }
  })
  routes.push({
    path: '/:pathMatch(.*)*',
    name: 'qiankun-not-found',
    component: RouteNotFound
  })
}

const router = createRouter({
  history: createWebHistory(
    qiankunWindow.__POWERED_BY_QIANKUN__
      ? '/dolphinscheduler'
      : import.meta.env.MODE === 'production'
      ? '/dolphinscheduler/ui/'
      : '/'
  ),
  routes
})

interface metaData {
  title?: string
  activeMenu?: string
  showSide?: boolean
  auth?: Array<string>
}

/**
 * Routing to intercept
 */
router.beforeEach(
  async (
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    next: NavigationGuardNext
  ) => {
    NProgress.start()
    const userStore = useUserStore()
    const metaData: metaData = to.meta
    if (
      metaData.auth?.includes('ADMIN_USER') &&
      (userStore.getUserInfo as UserInfoRes).userType !== 'ADMIN_USER' &&
      metaData.activeMenu === 'security'
    ) {
      to.fullPath = '/security/token-manage'
      next({ name: 'token-manage' })
    } else {
      next()
    }

    NProgress.done()
  }
)

router.afterEach(() => {
  NProgress.done()
})

export default router
