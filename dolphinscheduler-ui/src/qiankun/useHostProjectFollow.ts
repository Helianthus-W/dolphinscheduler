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

import { ref } from 'vue'
import router from '@/router'

/**
 * Host project follow (project integration P2): consumes the `project` key of
 * the qiankun global state dispatched by the base on every project switch.
 * Follow-jump policy: only when the payload carries a synced dsProjectCode and
 * the current route is inside a different project; otherwise stay put (the
 * list page highlights the current project instead of hijacking the landing).
 */
export const hostCurrentProject = ref<{
  dsProjectCode?: number | string
  projectName?: string
} | null>(null)

export function applyHostProject(project: Record<string, any> | null | undefined) {
  if (!project) return
  hostCurrentProject.value = project
  const dsCode = Number(project.dsProjectCode)
  if (!dsCode) return
  const match = router.currentRoute.value.path.match(/^\/projects\/(\d+)/)
  if (match && Number(match[1]) !== dsCode) {
    router.replace(`/projects/${dsCode}`)
  }
}
