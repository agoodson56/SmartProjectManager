-- D1 Schema for SmartProjectManager

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

-- Seed users (password: 3DTSI)
INSERT OR IGNORE INTO users (username, password_hash, role, must_change_password) VALUES
  ('Allan', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'admin', 1),
  ('Cos', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1),
  ('Brett', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1),
  ('Kurt', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1),
  ('Richard', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1);

-- Seed sample projects
INSERT OR IGNORE INTO projects (name, manager, lead_name, est_labor_hours, est_material_cost) VALUES
  ('Main Street Plaza', 'Cos', 'John Smith', 1000, 50000),
  ('Riverside Development', 'Brett', 'Sarah Wilson', 800, 40000),
  ('Tech Park Phase 1', 'Kurt', 'Mike Ross', 1200, 60000),
  ('Downtown Renovation', 'Richard', 'Jane Doe', 500, 25000);
