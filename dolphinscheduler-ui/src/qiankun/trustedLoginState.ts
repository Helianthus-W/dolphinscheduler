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

// 统一鉴权（qiankun 基座对接，阶段二）开关与运行时状态。
// enabled 对应后端 TRUSTED 认证（海豚子插件/qiankun子应用接入方案.md 3.2/3.7）；
// 关闭后子应用回退为原有 DS 登录页兜底行为。
export const trustedLoginState = {
  enabled: true,
  attempting: false,
  succeeded: false,
  // PORTAL identity source: the base authenticates every request, the
  // trusted exchange and sessionId plumbing are bypassed entirely
  portalMode: false
}
