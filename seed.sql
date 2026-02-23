-- Seed script for SmartProjectManager D1 database
-- Run this MANUALLY against your D1 database after creating it.
-- Default password for all users: 3DTSI (they will be forced to change on first login)
-- Generate a fresh hash with: npx -y bcryptjs '3DTSI'

-- To run: npx wrangler d1 execute smartprojectmanager-db --remote --file=seed.sql

INSERT OR IGNORE INTO users (username, password_hash, role, must_change_password) VALUES
  ('Allan', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'admin', 1),
  ('Cos', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1),
  ('Brett', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1),
  ('Kurt', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1),
  ('Richard', '$2b$10$uOSriunHtQvA0L84.tZZfelmtXl.XLMZXJDxmMsxX7V0TnrSBIVSu', 'manager', 1);

INSERT OR IGNORE INTO projects (name, manager, lead_name, est_labor_hours, est_material_cost) VALUES
  ('Main Street Plaza', 'Cos', 'John Smith', 1000, 50000),
  ('Riverside Development', 'Brett', 'Sarah Wilson', 800, 40000),
  ('Tech Park Phase 1', 'Kurt', 'Mike Ross', 1200, 60000),
  ('Downtown Renovation', 'Richard', 'Jane Doe', 500, 25000);
