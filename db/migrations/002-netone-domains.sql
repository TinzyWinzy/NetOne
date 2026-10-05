BEGIN;
CREATE TABLE IF NOT EXISTS netone_workspace (id TEXT PRIMARY KEY CHECK(id='current'), revision INTEGER NOT NULL, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_sites (id UUID PRIMARY KEY, external_ref TEXT UNIQUE NOT NULL, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_metrics (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), metric_code TEXT NOT NULL, period TEXT NOT NULL, period_start TIMESTAMPTZ NOT NULL, period_end TIMESTAMPTZ NOT NULL, value NUMERIC, unit TEXT NOT NULL, quality TEXT NOT NULL, source_ref TEXT NOT NULL, demo BOOLEAN NOT NULL, UNIQUE(site_id,metric_code,period));
CREATE TABLE IF NOT EXISTS netone_financials (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), period TEXT NOT NULL, currency TEXT NOT NULL, basis TEXT NOT NULL, snapshot JSONB NOT NULL, UNIQUE(site_id,period));
CREATE TABLE IF NOT EXISTS netone_interventions (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_source_mappings (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), source TEXT NOT NULL, external_ref TEXT NOT NULL, UNIQUE(source,external_ref));
CREATE TABLE IF NOT EXISTS netone_incidents (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), status TEXT NOT NULL, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_incident_events (id UUID PRIMARY KEY, incident_id UUID NOT NULL REFERENCES netone_incidents(id), snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_rule_versions (id UUID PRIMARY KEY, code TEXT NOT NULL, version TEXT NOT NULL, status TEXT NOT NULL, snapshot JSONB NOT NULL, UNIQUE(code,version));
CREATE TABLE IF NOT EXISTS netone_rule_evaluations (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), rule_id UUID NOT NULL REFERENCES netone_rule_versions(id), snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_model_configs (id UUID PRIMARY KEY, version INTEGER UNIQUE NOT NULL, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_candidate_evidence (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES netone_sites(id), config_id UUID NOT NULL REFERENCES netone_model_configs(id), evidence_hash CHAR(64) NOT NULL, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_investment_candidates (id UUID PRIMARY KEY, evidence_id UUID NOT NULL REFERENCES netone_candidate_evidence(id), site_id UUID NOT NULL REFERENCES netone_sites(id), candidate_key TEXT NOT NULL, model_version TEXT NOT NULL, score NUMERIC, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_score_components (id UUID PRIMARY KEY, evidence_id UUID NOT NULL REFERENCES netone_candidate_evidence(id), component_code TEXT NOT NULL, snapshot JSONB NOT NULL, UNIQUE(evidence_id,component_code));
CREATE TABLE IF NOT EXISTS netone_import_runs (id UUID PRIMARY KEY, import_key TEXT UNIQUE NOT NULL, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_reviews (id UUID PRIMARY KEY, snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_score_runs (id UUID PRIMARY KEY, snapshot JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS netone_metric_period ON netone_metrics(period,metric_code);
CREATE INDEX IF NOT EXISTS netone_incident_state ON netone_incidents(status);
CREATE OR REPLACE FUNCTION netone_replace_workspace(expected_revision INTEGER, next_snapshot JSONB) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE next_revision INTEGER := (next_snapshot->>'revision')::INTEGER;
BEGIN
  IF next_revision <> expected_revision + 1 THEN RAISE EXCEPTION 'Invalid workspace revision' USING ERRCODE='40001'; END IF;
  IF expected_revision = -1 THEN
    INSERT INTO netone_workspace(id,revision,snapshot) VALUES('current',next_revision,next_snapshot) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE netone_workspace SET revision=next_revision,snapshot=next_snapshot WHERE id='current' AND revision=expected_revision;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workspace changed; reload and retry' USING ERRCODE='40001'; END IF;
  RETURN next_revision;
END;
$$;
COMMIT;
