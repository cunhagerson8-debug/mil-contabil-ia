-- Password recovery tokens, request queue, and session revocation version.

ALTER TABLE users
  ADD COLUMN session_version integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_users_session_version_nonnegative CHECK (session_version >= 0);

CREATE TABLE password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_password_reset_token_hash_sha256
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_password_reset_token_expiry_after_creation
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX uq_password_reset_tokens_hash
  ON password_reset_tokens(token_hash);

CREATE UNIQUE INDEX uq_password_reset_tokens_open_per_user
  ON password_reset_tokens(user_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX idx_password_reset_tokens_expiry
  ON password_reset_tokens(expires_at);

CREATE TABLE password_reset_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text,
  email_hash        text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  attempts          integer NOT NULL DEFAULT 0,
  available_at      timestamptz NOT NULL DEFAULT now(),
  locked_at         timestamptz,
  completed_at      timestamptz,
  last_error_code   text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_password_reset_email_hash_hmac
    CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_password_reset_request_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT chk_password_reset_request_attempts
    CHECK (attempts BETWEEN 0 AND 5),
  CONSTRAINT chk_password_reset_request_email_state
    CHECK (
      (status IN ('pending', 'processing') AND email IS NOT NULL)
      OR (status IN ('completed', 'failed') AND email IS NULL)
    )
);

CREATE INDEX idx_password_reset_requests_pending
  ON password_reset_requests(available_at, created_at)
  WHERE status = 'pending';

CREATE INDEX idx_password_reset_requests_email_hash_created
  ON password_reset_requests(email_hash, created_at DESC);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE password_reset_tokens TO mil_platform_admin;
GRANT ALL ON TABLE password_reset_requests TO mil_platform_admin;

COMMENT ON TABLE password_reset_tokens IS
  'Uso único e expiração de links de recuperação; guarda somente SHA-256 do token.';

COMMENT ON TABLE password_reset_requests IS
  'Fila temporária de solicitações; o e-mail é apagado após processamento.';
