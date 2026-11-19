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

package org.apache.dolphinscheduler.api.security.impl.trusted;

import org.apache.dolphinscheduler.api.security.impl.AbstractAuthenticator;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.dao.entity.User;

import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

/**
 * Trusted authenticator: the caller is verified as a trusted gateway by the
 * controller (shared secret header) before this authenticator is invoked, so
 * only the local user lookup / auto-provisioning and session creation happen
 * here.
 */
@Slf4j
public class TrustedAuthenticator extends AbstractAuthenticator {

    @Override
    public User login(@NonNull String userId, String password) {
        User user = userService.getUserByUserName(userId);
        if (user == null) {
            try {
                user = userService.createUser(UserType.GENERAL_USER, userId, null);
                log.info("Trusted login auto-provisioned local user, userName:{}.", userId);
            } catch (Exception e) {
                log.error("Failed to auto-provision user for trusted login, userName:{}.", userId, e);
                return null;
            }
        }
        return user;
    }
}
