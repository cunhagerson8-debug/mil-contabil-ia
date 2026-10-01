-- =============================================================================
-- 016_user_invitations.sql
-- Convites de usuários com token de uso único e expiração.
-- Tokens puros nunca são armazenados; token_hash contém SHA-256 em hexadecimal.
-- =============================================================================

CREATE TABLE user_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT chk_user_invitations_token_hash_sha256
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_user_invitations_expiry_after_creation
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX uq_user_invitations_token_hash
  ON user_invitations(token_hash);

CREATE UNIQUE INDEX uq_user_invitations_open_per_user
  ON user_invitations(user_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX idx_user_invitations_user_id
  ON user_invitations(user_id);

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_invitations_select_firm_owner
  ON user_invitations
  FOR SELECT
  USING (
    app_current_role() = 'firm_owner'
    AND EXISTS (
      SELECT 1 FROM users invited_user
      WHERE invited_user.id = user_invitations.user_id
        AND invited_user.firm_id = app_current_firm_id()
    )
  );

CREATE POLICY user_invitations_insert_firm_owner
  ON user_invitations
  FOR INSERT
  WITH CHECK (
    app_current_role() = 'firm_owner'
    AND created_by = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM users invited_user
      WHERE invited_user.id = user_invitations.user_id
        AND invited_user.firm_id = app_current_firm_id()
        AND invited_user.status = 'invited'
    )
  );

CREATE POLICY user_invitations_update_firm_owner
  ON user_invitations
  FOR UPDATE
  USING (
    app_current_role() = 'firm_owner'
    AND EXISTS (
      SELECT 1 FROM users invited_user
      WHERE invited_user.id = user_invitations.user_id
        AND invited_user.firm_id = app_current_firm_id()
    )
  )
  WITH CHECK (
    app_current_role() = 'firm_owner'
    AND EXISTS (
      SELECT 1 FROM users invited_user
      WHERE invited_user.id = user_invitations.user_id
        AND invited_user.firm_id = app_current_firm_id()
    )
  );

GRANT SELECT, INSERT, UPDATE ON user_invitations TO mil_app;
GRANT ALL ON TABLE user_invitations TO mil_platform_admin;

COMMENT ON TABLE user_invitations IS
  'Convites de usuários. Armazena somente SHA-256 do token, nunca o token puro.';
