-- D1 Schema for SmartProjectManager
-- NOTE: Run the seed script separately to create users.
-- Do NOT commit password hashes to version control.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'manager',
  must_change_password INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  manager TEXT NOT NULL,
  lead_name TEXT DEFAULT '',
  est_labor_hours REAL DEFAULT 0,
  used_labor_hours REAL DEFAULT 0,
  est_material_cost REAL DEFAULT 0,
  used_material_cost REAL DEFAULT 0,
  est_odc REAL DEFAULT 0,
  used_odc REAL DEFAULT 0,
  completed_at TEXT,
  deadline TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  labor_hours_per_unit REAL NOT NULL DEFAULT 0,
  quantity_used REAL NOT NULL DEFAULT 0,
  actual_labor_hours REAL NOT NULL DEFAULT 0,
  is_addon INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
