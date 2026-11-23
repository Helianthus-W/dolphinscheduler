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

package org.apache.dolphinscheduler.api.security;

/**
 * Request-scoped marker set by {@code TrustedServiceMarkFilter} when the
 * request carries a valid X-Trusted-Client shared secret. Project-mutation
 * guards consult it to exempt server-to-server calls (the base sync service)
 * from the project-level write ban while still blocking direct browser calls.
 */
public final class TrustedServiceContext {

    private static final ThreadLocal<Boolean> TRUSTED = new ThreadLocal<>();

    private TrustedServiceContext() {
    }

    public static void markTrusted() {
        TRUSTED.set(Boolean.TRUE);
    }

    public static void clear() {
        TRUSTED.remove();
    }

    public static boolean isTrustedService() {
        return Boolean.TRUE.equals(TRUSTED.get());
    }
}
