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

package org.apache.dolphinscheduler.api.security.impl.portal;

import org.apache.dolphinscheduler.api.enums.Status;
import org.apache.dolphinscheduler.api.security.Authenticator;
import org.apache.dolphinscheduler.api.service.UsersService;
import org.apache.dolphinscheduler.api.utils.Result;
import org.apache.dolphinscheduler.common.enums.UserType;
import org.apache.dolphinscheduler.dao.entity.User;
import org.apache.dolphinscheduler.dao.mapper.UserMapper;

import org.apache.commons.lang3.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;

import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.WebUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Portal authenticator (identity source = the base portal): DolphinScheduler
 * abandons its own session authentication and resolves every request's identity
 * from the base. Browser path: forwards the portal session cookie to the portal
 * validation endpoint (short-TTL cached, fail-closed). Service path: trusts the
 * X-Portal-User header only when the shared-secret X-Trusted-Client header is
 * valid. Both paths resolve to a local shadow user keyed by the portal user
 * name (auto-provisioned GENERAL_USER with a null password, so it can never log
 * in locally under any authentication type).
 */
@Slf4j
public class PortalAuthenticator implements Authenticator {

    static final String TRUSTED_CLIENT_HEADER = "X-Trusted-Client";
    static final String PORTAL_USER_HEADER = "X-Portal-User";

    @Autowired
    private UsersService userService;

    @Autowired
    private UserMapper userMapper;

    @Value("${security.authentication.trusted.shared-secret:}")
    private String sharedSecret;

    @Value("${security.authentication.portal.validate-url:}")
    private String validateUrl;

    @Value("${security.authentication.portal.cookie-name:dlite_login_token}")
    private String portalCookieName;

    @Value("${security.authentication.portal.alternate-cookie-name:lvfa_token}")
    private String alternateCookieName;

    @Value("${security.authentication.portal.cache-ttl-seconds:30}")
    private long cacheTtlSeconds;

    /**
     * 临时通道：逗号分隔的门户用户名白名单，名单内用户的影子用户在 DS 为 ADMIN
     * （角色对齐期使用；正式方案是基座安全中心统一管控，白名单收敛后应清空）
     */
    @Value("${security.authentication.portal.admin-users:}")
    private String adminUsers;

    @Value("${security.authentication.portal.connect-timeout-ms:3000}")
    private int connectTimeoutMs;

    @Value("${security.authentication.portal.read-timeout-ms:5000}")
    private int readTimeoutMs;

    private final ConcurrentHashMap<String, PortalIdentity> identityCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> provisionLocks = new ConcurrentHashMap<>();

    private volatile RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Result<Map<String, String>> authenticate(@NonNull String userId, String password, @NonNull String ip) {
        // Interactive login is disabled in PORTAL mode: identity comes from the
        // base portal on every request, so the login endpoint should not be used.
        Result<Map<String, String>> result = new Result<>();
        result.setCode(Status.USER_NAME_PASSWD_ERROR.getCode());
        result.setMsg(Status.USER_NAME_PASSWD_ERROR.getMsg());
        return result;
    }

    @Override
    public User getAuthUser(HttpServletRequest request) {
        String assertedUser = resolveAssertedUser(request);
        if (assertedUser != null) {
            if (assertedUser.isEmpty()) {
                // valid service secret without a user header: misconfigured call
                return null;
            }
            return resolveLocalUser(assertedUser, false);
        }
        String cookieValue = extractPortalCookie(request);
        if (cookieValue == null) {
            return null;
        }
        PortalIdentity identity = resolveByPortalCookie(cookieValue);
        if (identity == null) {
            return null;
        }
        return resolveLocalUser(identity.userName, identity.portalAdmin);
    }

    /**
     * Service path: trust X-Portal-User only when the shared secret header is
     * valid. A user header without a valid secret is ignored (never trusted),
     * falling through to the browser cookie path.
     *
     * @return asserted user name, "" when the secret is valid but the user
     *         header is missing, null when no valid secret header is present
     */
    private String resolveAssertedUser(HttpServletRequest request) {
        String trustedHeader = request.getHeader(TRUSTED_CLIENT_HEADER);
        if (StringUtils.isBlank(trustedHeader) || StringUtils.isBlank(sharedSecret)) {
            return null;
        }
        boolean secretOk = MessageDigest.isEqual(sharedSecret.getBytes(StandardCharsets.UTF_8),
                trustedHeader.getBytes(StandardCharsets.UTF_8));
        if (!secretOk) {
            log.warn("Portal auth ignored X-Portal-User: invalid {} header", TRUSTED_CLIENT_HEADER);
            return null;
        }
        return StringUtils.trimToEmpty(request.getHeader(PORTAL_USER_HEADER));
    }

    private String extractPortalCookie(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, portalCookieName);
        if (cookie == null && StringUtils.isNotBlank(alternateCookieName)) {
            cookie = WebUtils.getCookie(request, alternateCookieName);
        }
        return cookie == null ? null : cookie.getValue();
    }

    private PortalIdentity resolveByPortalCookie(String cookieValue) {
        long now = System.currentTimeMillis();
        PortalIdentity cached = identityCache.get(cookieValue);
        if (cached != null) {
            if (cached.expireAt > now) {
                return cached;
            }
            identityCache.remove(cookieValue, cached);
        }
        PortalIdentity identity = validateWithPortal(cookieValue);
        if (identity != null) {
            identityCache.put(cookieValue, new PortalIdentity(identity.userName, identity.portalAdmin,
                    now + cacheTtlSeconds * 1000L));
        }
        return identity;
    }

    private PortalIdentity validateWithPortal(String cookieValue) {
        if (StringUtils.isBlank(validateUrl)) {
            log.warn("Portal auth: security.authentication.portal.validate-url is not configured.");
            return null;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            // the portal endpoint content-negotiates: without an explicit JSON
            // Accept it answers XML (verified against dlite-portal), which the
            // JSON parser would reject and fail-closed 401
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
            headers.add(HttpHeaders.COOKIE, portalCookieName + "=" + cookieValue);
            ResponseEntity<String> response = getRestTemplate().exchange(validateUrl, HttpMethod.POST,
                    new HttpEntity<>(headers), String.class);
            JsonNode root = objectMapper.readTree(response.getBody());
            if (root.path("code").asInt(-1) != 0) {
                return null;
            }
            JsonNode data = root.path("data");
            String name = data.path("name").asText(null);
            if (StringUtils.isBlank(name)) {
                return null;
            }
            // 门户用户类型动态映射：0=超级管理员/1=管理员 -> DS ADMIN，其余 -> DS GENERAL
            int portalType = data.path("type").asInt(-1);
            return new PortalIdentity(name, portalType == 0 || portalType == 1, 0L);
        } catch (Exception e) {
            // fail-closed: portal unreachable / unexpected payload -> 401
            log.warn("Portal auth validation failed: {}", e.toString());
            return null;
        }
    }

    private User resolveLocalUser(String userName, boolean portalAdmin) {
        User user = userService.getUserByUserName(userName);
        UserType desiredType = (portalAdmin || isListedAdmin(userName)) ? UserType.ADMIN_USER : UserType.GENERAL_USER;
        if (user != null) {
            // 影子用户（密码 NULL，不可本地登录）的类型随门户身份双向对齐：
            // 门户管理员(type 0/1) <-> DS ADMIN，普通用户 <-> DS GENERAL；本地自建
            // 用户（含内置 admin）有密码，不受同步影响
            if (user.getUserPassword() == null && user.getUserType() != desiredType) {
                user.setUserType(desiredType);
                userMapper.updateById(user);
                log.info("Portal auth synced shadow user type, userName:{}, type:{}.", userName, desiredType);
            }
            return user;
        }
        // Concurrent first hits (the home page fires several requests at once)
        // must not race each other into duplicate-name inserts
        Object lock = provisionLocks.computeIfAbsent(userName, key -> new Object());
        synchronized (lock) {
            user = userService.getUserByUserName(userName);
            if (user != null) {
                return user;
            }
            try {
                user = userService.createUser(desiredType, userName, null);
                log.info("Portal auth auto-provisioned shadow user, userName:{}, type:{}.", userName, desiredType);
            } catch (Exception e) {
                // lost the provisioning race: another thread just inserted it
                user = userService.getUserByUserName(userName);
                if (user == null) {
                    log.error("Portal auth failed to auto-provision user, userName:{}.", userName, e);
                }
            }
            return user;
        }
    }

    private boolean isListedAdmin(String userName) {
        if (adminUsers == null || adminUsers.trim().isEmpty() || userName == null) {
            return false;
        }
        for (String item : adminUsers.split("[,，\\s]+")) {
            if (userName.equalsIgnoreCase(item.trim())) {
                return true;
            }
        }
        return false;
    }

    private RestTemplate getRestTemplate() {
        if (restTemplate == null) {
            synchronized (this) {
                if (restTemplate == null) {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(connectTimeoutMs);
                    factory.setReadTimeout(readTimeoutMs);
                    restTemplate = new RestTemplate(factory);
                }
            }
        }
        return restTemplate;
    }

    private static final class PortalIdentity {

        private final String userName;
        private final boolean portalAdmin;
        private final long expireAt;

        private PortalIdentity(String userName, boolean portalAdmin, long expireAt) {
            this.userName = userName;
            this.portalAdmin = portalAdmin;
            this.expireAt = expireAt;
        }
    }
}
