BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(160) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES app_organizations(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    email varchar(254) UNIQUE NOT NULL,
    password_salt text NOT NULL,
    password_hash text NOT NULL,
    role varchar(30) NOT NULL DEFAULT 'owner',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_client_states (
    organization_id uuid PRIMARY KEY REFERENCES app_organizations(id) ON DELETE CASCADE,
    profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    employees jsonb NOT NULL DEFAULT '[]'::jsonb,
    sales_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_audit_events (
    id bigserial PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES app_organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
    action varchar(100) NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_organization ON app_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expiration ON app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_audit_organization_created ON app_audit_events(organization_id, created_at DESC);

ALTER TABLE app_client_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_client_states_organization_isolation ON app_client_states;
CREATE POLICY app_client_states_organization_isolation ON app_client_states
    USING (organization_id::text = current_setting('app.organization_id', true))
    WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS app_audit_organization_isolation ON app_audit_events;
CREATE POLICY app_audit_organization_isolation ON app_audit_events
    USING (organization_id::text = current_setting('app.organization_id', true))
    WITH CHECK (organization_id::text = current_setting('app.organization_id', true));

COMMIT;
