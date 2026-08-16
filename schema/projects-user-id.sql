-- Scopes projects to a Better Auth user. Run once on existing D1 databases.
ALTER TABLE projects ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
