# AGENTS.md

Guidance for AI coding agents working in the Apache DolphinScheduler repository.

## Project overview

Apache DolphinScheduler is a distributed data workflow orchestration platform (Java 8, Spring Boot 2.6.1, multi-module Maven). Runtime roles: **MasterServer** (DAG split, task dispatch, failover), **WorkerServer** (task execution, log service), **ApiApplicationServer** (REST API for the Vue 3 UI), **AlertServer**. Servers coordinate through a pluggable registry (ZooKeeper default, also etcd/JDBC) and share state in a relational metadata DB.

## Toolchain

- Java **1.8** (`pom.xml` `<java.version>`); CI also builds on JDK 11. Maven via wrapper — pinned 3.8.4 (`.mvn/wrapper/maven-wrapper.properties`).
- Use `./mvnw` (Git Bash / Linux) or `mvnw.cmd` (cmd/PowerShell, requires `JAVA_HOME`). Maven ≥ 3.5.
- Frontend: Node **v16.13.1** + pnpm **v6.x** (pinned by frontend-maven-plugin; UI build is part of the Maven reactor).

## Build commands

- Full build (documented): `./mvnw clean install -Prelease -Dmaven.test.skip=true`
- CI-style package: `./mvnw -B clean install -Prelease -Dmaven.test.skip=true -Dspotless.skip=true`
- Single module + dependencies: `./mvnw -pl :<artifactId> -am <goal>` (e.g. `-pl :dolphinscheduler-common`)
- Docker images: `./mvnw -B clean package -Dmaven.test.skip -Pdocker,release -Ddocker.tag=<TAG>`
- Format code: `./mvnw spotless:apply` — **Spotless `check` is bound to `compile`**, so unformatted code fails every build unless `-Dspotless.skip=true`.

## Testing

- Unit tests: `./mvnw clean verify -B -Dmaven.test.skip=false -Dspotless.skip=true -DskipUT=false` (JUnit 5; `skipUT` defaults false). Surefire defaults (no forkCount config); no failsafe.
- Single test: `./mvnw test -pl :dolphinscheduler-common -Dtest=ConstantsTest -am`
- Coverage: JaCoCo offline instrumentation, report at `target/site/jacoco/jacoco.xml`. **No coverage thresholds are enforced** — reported to Codecov/SonarCloud only.
- Test naming: unit `*Test.java`; e2e `*E2ETest.java`; api-test `*APITest.java`. `*IT.java` classes in `dolphinscheduler-tools` are not run by default.
- `dolphinscheduler-e2e` (Selenium, Page Object Model) and `dolphinscheduler-api-test` (HTTP) are separate suites, NOT in the root `<modules>`; CI runs them via `./mvnw -B -f dolphinscheduler-e2e/pom.xml -am -Dtest=<FQCN> test` against a standalone-server Docker image.

## Code style (enforced by Spotless only — there is no Checkstyle)

- Formatter profile: `style/spotless_dolphinscheduler_formatter.xml` (4-space indent, no tabs, 120-col).
- Import order (`style/eclipse.importorder`): `org.apache.dolphinscheduler` → `org.apache` → `java` → `javax` → `org` → `com`.
- Banned imports (regex): wildcards, `org.powermock`, JUnit 4 (`org.junit` non-jupiter), `io.kubernetes.client`.
- `./mvnw spotless:apply` fixes everything including pom sorting and `docs/**/*.md` formatting.
- Every source file needs the Apache license header (SPDX Apache-2.0, config `.licenserc.yaml`, checked by skywalking-eyes in CI).

## CI checks a PR must pass

- Sanity: license header + `./mvnw spotless:check`.
- Backend build (`backend.yml`): full install on JDK 8 & 11; dependency-license check `tools/dependencies/check-LICENSE.sh`; cluster tests (MySQL/PostgreSQL × ZK/JDBC registry).
- Unit tests on JDK 8 & 11, then Codecov + SonarCloud.
- Schema changes require upgrade scripts in `dolphinscheduler-dao/src/main/resources/sql/upgrade` (CI runs `atlas schema diff`).
- Docs PRs: spotless, `python img_utils.py -v dev-syntax/check`, dead-link check (`.dlc.json`).

## Commit / PR conventions

- Commit message: `[DS-ISSUE][type] subject` — types `feat|fix|docs|style|refactor|test|chore`; subject ≤ 50 chars, body wraps at 72 (`docs/docs/en/contribute/join/commit-message.md`).
- PR title: `[Feature-3333][module] Title` or `[Fix-3333][module] Title`.

## Module map (root `pom.xml` `<modules>`)

- **Servers**: `dolphinscheduler-master`, `dolphinscheduler-worker`, `dolphinscheduler-api`, `dolphinscheduler-alert` (alert-server + alert plugins), `dolphinscheduler-standalone-server` (single-process dev server).
- **Shared libs**: `dolphinscheduler-common`, `dolphinscheduler-aop`, `dolphinscheduler-service` (business logic shared by master/worker/alert), `dolphinscheduler-dao` (MyBatis over `t_ds_*` tables), `dolphinscheduler-extract` (Netty RPC: -base/-common/-master/-worker/-alert), `dolphinscheduler-spi` (plugin contracts), `dolphinscheduler-meter`, `dolphinscheduler-microbench` (JMH).
- **Plugin families** (each has `-api` + per-plugin submodules + `*-all` aggregate):
  - `dolphinscheduler-task-plugin` (~40 task types), `dolphinscheduler-datasource-plugin`, `dolphinscheduler-storage-plugin` — register via `@AutoService` on the `*Factory` class (generates `META-INF/services`, loaded by `PrioritySPIFactory`).
  - `dolphinscheduler-registry`, `dolphinscheduler-scheduler-plugin`, `dolphinscheduler-dao-plugin` — register via Spring Boot `META-INF/spring.factories` auto-configuration.
- **Other**: `dolphinscheduler-bom` (dependency management), `dolphinscheduler-dist` (assembly; defines the `release` profile), `dolphinscheduler-tools` (upgrade/migration CLI), `dolphinscheduler-ui` (Vue 3 + Vite + TS frontend), `dolphinscheduler-data-quality`, `dolphinscheduler-e2e` / `dolphinscheduler-api-test` (not in root reactor).

## Plugin development notes

- New task plugin: implement `TaskChannel` (+ `TaskChannelFactory` extending `PrioritySPI`, resolve name collisions via `getIdentify`); see `docs/docs/en/contribute/backend/spi/task.md`. Task plugins run in the worker; the frontend form must be added separately in `dolphinscheduler-ui` (no frontend SPI).
- New API/i18n keys: add to `dolphinscheduler-api/src/main/resources/i18n/messages.properties`, `messages_en_US.properties`, and `messages_zh_CN.properties`.

## Running locally

- **Standalone (recommended for dev)**: run `main()` of `org.apache.dolphinscheduler.StandaloneServer` (`dolphinscheduler-standalone-server`). Uses embedded H2 (`jdbc:h2:mem:dolphinscheduler`) and an embedded ZooKeeper TestingServer — no external services needed. UI/API at `http://localhost:12345/dolphinscheduler/`, login `admin/dolphinscheduler123`. Profile overrides `mysql`/`postgresql` exist in its `application.yaml`.
- **Full cluster mode**: external ZooKeeper + MySQL/PostgreSQL (init SQL at `dolphinscheduler-dao/src/main/resources/sql/dolphinscheduler_{mysql,postgresql}.sql`); run `MasterServer`, `WorkerServer`, `ApiApplicationServer` mains with `-Dspring.profiles.active=mysql`. For MySQL set `mysql-connector-java` scope to `compile` in the root `pom.xml`.
- **Frontend dev**: `cd dolphinscheduler-ui && pnpm install && pnpm run dev` → http://localhost:5173.
- **Docker**: `deploy/docker/` — `docker-compose --profile schema up -d` then `docker-compose --profile all up -d` (prebuilt images, env in `deploy/docker/.env`).
- Supported DBs: H2, MySQL, PostgreSQL. Registries: ZooKeeper (default), etcd, JDBC.
