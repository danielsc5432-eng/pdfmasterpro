-- Assinaturas (planos mensal/anual) e log de eventos de cobrança.
-- Provider inicial: mercadopago (preapproval / assinatura recorrente).

CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) NOT NULL,
  open_id VARCHAR(191) NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'mercadopago',
  plan_id VARCHAR(40) NOT NULL,
  status ENUM('pending','authorized','paused','cancelled','expired','rejected') NOT NULL DEFAULT 'pending',
  provider_subscription_id VARCHAR(191) NULL,
  provider_payer_email VARCHAR(320) NULL,
  amount_cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  frequency INT UNSIGNED NOT NULL,
  frequency_type VARCHAR(10) NOT NULL DEFAULT 'months',
  external_reference VARCHAR(191) NULL,
  started_at DATETIME(3) NULL,
  current_period_end DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY subscriptions_open_id_idx (open_id, status),
  KEY subscriptions_provider_idx (provider, provider_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_events (
  id CHAR(36) NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'mercadopago',
  topic VARCHAR(60) NULL,
  status VARCHAR(40) NULL,
  provider_resource_id VARCHAR(191) NULL,
  payload JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY billing_events_created_idx (created_at),
  KEY billing_events_resource_idx (provider, provider_resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
