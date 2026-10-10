CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(191) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS processing_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  session_hash CHAR(64) NOT NULL,
  tool_slug VARCHAR(80) NOT NULL,
  status ENUM('processing', 'completed', 'failed') NOT NULL,
  file_count INT UNSIGNED NOT NULL,
  input_bytes BIGINT UNSIGNED NOT NULL,
  output_bytes BIGINT UNSIGNED NULL,
  output_type VARCHAR(100) NULL,
  error_code VARCHAR(80) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at TIMESTAMP(3) NULL,
  expires_at TIMESTAMP(3) NULL,
  INDEX idx_processing_tasks_session_created (session_hash, created_at),
  INDEX idx_processing_tasks_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
