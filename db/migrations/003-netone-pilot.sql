BEGIN;
CREATE TABLE IF NOT EXISTS netone_obligation_versions (id UUID PRIMARY KEY,snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_cells (id UUID PRIMARY KEY,site_id UUID NOT NULL REFERENCES netone_sites(id),snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_cell_measurements (id UUID PRIMARY KEY,cell_id UUID NOT NULL REFERENCES netone_cells(id),snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_obligation_findings (id UUID PRIMARY KEY,snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_corrective_cases (id UUID PRIMARY KEY,site_id UUID NOT NULL REFERENCES netone_sites(id),snapshot JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS netone_privacy_reviews (id UUID PRIMARY KEY,snapshot JSONB NOT NULL);
COMMIT;
