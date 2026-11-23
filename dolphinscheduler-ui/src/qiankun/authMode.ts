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

// Identity/auth policy reported by GET /login/auth-mode (excluded from the
// login interceptor). PORTAL: the base authenticates every request, so the
// sub-app skips the trusted exchange, sends no sessionId, and redirects to
// the base on 401. projectCreationEnabled=false: the base owns project
// creation, so project-level write entries are hidden. Any failure falls
// back to the legacy defaults (PASSWORD / creation enabled).
interface AuthPolicy {
  type: string
  projectCreationEnabled: boolean
}

let cachedPolicy: AuthPolicy | null = null

async function getAuthPolicy(): Promise<AuthPolicy> {
  if (cachedPolicy) return cachedPolicy
  const fallback: AuthPolicy = {
    type: 'PASSWORD',
    projectCreationEnabled: true
  }
  try {
    const base =
      import.meta.env.MODE === 'development'
        ? '/dolphinscheduler'
        : `${import.meta.env.VITE_APP_PROD_WEB_URL}/dolphinscheduler`
    const res = await fetch(`${base}/login/auth-mode`, {
      credentials: 'same-origin'
    })
    const json = await res.json()
    cachedPolicy = {
      type: json?.data?.type || 'PASSWORD',
      projectCreationEnabled: Boolean(json?.data?.projectCreationEnabled ?? true)
    }
  } catch (e) {
    cachedPolicy = fallback
  }
  return cachedPolicy
}

export async function getAuthMode(): Promise<string> {
  return (await getAuthPolicy()).type
}

export async function isProjectCreationEnabled(): Promise<boolean> {
  return (await getAuthPolicy()).projectCreationEnabled
}
