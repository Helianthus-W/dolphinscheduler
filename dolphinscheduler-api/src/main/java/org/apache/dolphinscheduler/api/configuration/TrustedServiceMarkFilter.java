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

package org.apache.dolphinscheduler.api.configuration;

import org.apache.dolphinscheduler.api.security.TrustedServiceContext;

import org.apache.commons.lang3.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Marks requests that carry the valid X-Trusted-Client shared secret as trusted
 * server-to-server calls (see {@link TrustedServiceContext}). The project write
 * ban exempts such calls so the base sync service keeps working; browser calls
 * never carry the secret (the gateway injects it only for service routes).
 */
@Component
@Order(1)
@Slf4j
public class TrustedServiceMarkFilter extends OncePerRequestFilter {

    @Value("${security.authentication.trusted.shared-secret:}")
    private String sharedSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String trustedHeader = request.getHeader("X-Trusted-Client");
            if (StringUtils.isNotBlank(trustedHeader) && StringUtils.isNotBlank(sharedSecret)
                    && MessageDigest.isEqual(sharedSecret.getBytes(StandardCharsets.UTF_8),
                            trustedHeader.getBytes(StandardCharsets.UTF_8))) {
                TrustedServiceContext.markTrusted();
            }
            filterChain.doFilter(request, response);
        } finally {
            TrustedServiceContext.clear();
        }
    }
}
