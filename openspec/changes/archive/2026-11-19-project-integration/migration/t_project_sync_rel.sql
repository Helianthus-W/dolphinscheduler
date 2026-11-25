-- =============================================================
-- 项目一体化 P1：基座项目 ↔ DolphinScheduler 项目 映射与同步状态表
-- 幂等：uk_base_code 唯一；重复执行本脚本不会报错（CREATE TABLE IF NOT EXISTS）
-- =============================================================
CREATE TABLE IF NOT EXISTS t_project_sync_rel (
  id                BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  base_project_code VARCHAR(64)  NOT NULL COMMENT '基座项目编码 t_project_info_data.code',
  ds_project_code   BIGINT       NULL     COMMENT 'DS 项目 code t_ds_project.code（雪花码）',
  project_name      VARCHAR(255) NOT NULL COMMENT '冗余项目名（重试自愈用）',
  creator_user      VARCHAR(64)  NOT NULL COMMENT '冗余创建人门户用户名（DS 归属/重试用）',
  sync_status       VARCHAR(16)  NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/SYNCED/FAILED',
  fail_reason       VARCHAR(512) NULL     COMMENT '最近一次失败原因',
  retry_count       INT          NOT NULL DEFAULT 0 COMMENT '已重试次数',
  create_time       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  update_time       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_base_code (base_project_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='基座↔DS 项目同步映射表';

-- 存量核对（执行后应为基座项目数 = SYNCED 数；历史项目回填走单独脚本，见 海豚子插件/项目一体化同步方案.md §6）
-- SELECT sync_status, COUNT(*) FROM t_project_sync_rel GROUP BY sync_status;
