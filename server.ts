import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import bcryptjs from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// Handle BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const db = new Database("projects.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manager TEXT NOT NULL,
    lead_name TEXT DEFAULT '',
    est_labor_hours REAL DEFAULT 0,
    used_labor_hours REAL DEFAULT 0,
    est_material_cost REAL DEFAULT 0,
    used_material_cost REAL DEFAULT 0,
    completed_at DATETIME,
    deadline DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add deadline column if it doesn't exist
try {
  db.prepare("ALTER TABLE projects ADD COLUMN deadline DATETIME").run();
} catch (e) { }

// Migration: Add completed_at column if it doesn't exist
try {
  db.prepare("ALTER TABLE projects ADD COLUMN completed_at DATETIME").run();
} catch (e) { }

// Migration: Add lead_name column if it doesn't exist
try {
  db.prepare("ALTER TABLE projects ADD COLUMN lead_name TEXT DEFAULT ''").run();
} catch (e) {
  // Column already exists or other error
}

// Migration: Add ODC columns if they don't exist
try {
  db.prepare("ALTER TABLE projects ADD COLUMN est_odc REAL DEFAULT 0").run();
} catch (e) { }
try {
  db.prepare("ALTER TABLE projects ADD COLUMN used_odc REAL DEFAULT 0").run();
} catch (e) { }

// Create materials table
db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    labor_hours_per_unit REAL DEFAULT 0,
    unit_cost REAL DEFAULT 0,
    quantity_used REAL DEFAULT 0,
    actual_labor_hours REAL DEFAULT 0,
    is_addon INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )
`);
// Migration: Add unit_cost column if missing
try {
  db.prepare("ALTER TABLE materials ADD COLUMN unit_cost REAL DEFAULT 0").run();
} catch (e) { }
try {
  db.prepare("ALTER TABLE projects ADD COLUMN used_odc REAL DEFAULT 0").run();
} catch (e) { }

// ========== AUTH TABLES ==========
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'manager',
    must_change_password INTEGER NOT NULL DEFAULT 1
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Seed users if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const defaultHash = bcryptjs.hashSync("3DTSI", 10);
  const insertUser = db.prepare("INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)");
  insertUser.run("Allan", defaultHash, "admin");
  insertUser.run("Cos", defaultHash, "manager");
  insertUser.run("Brett", defaultHash, "manager");
  insertUser.run("Kurt", defaultHash, "manager");
  insertUser.run("Richard", defaultHash, "manager");
  insertUser.run("Daniel", defaultHash, "manager");
}
// Ensure Daniel exists (migration for existing DBs)
try {
  const daniel = db.prepare("SELECT id FROM users WHERE username = 'Daniel'").get();
  if (!daniel) {
    const defaultHash = bcryptjs.hashSync("3DTSI", 10);
    db.prepare("INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)").run("Daniel", defaultHash, "manager");
  }
} catch (e) { }

// Helper: get user from session token
function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const session = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token) as { user_id: number } | undefined;
  if (!session) return null;
  const user = db.prepare("SELECT id, username, role, must_change_password FROM users WHERE id = ?").get(session.user_id) as any;
  if (!user) return null;
  return { ...user, must_change_password: !!user.must_change_password };
}

// Seed initial project data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare("INSERT INTO projects (name, manager, lead_name, est_labor_hours, est_material_cost) VALUES (?, ?, ?, ?, ?)");
  insert.run("Main Street Plaza", "Cos", "John Smith", 1000, 50000);
  insert.run("Riverside Development", "Brett", "Sarah Wilson", 800, 40000);
  insert.run("Tech Park Phase 1", "Kurt", "Mike Ross", 1200, 60000);
  insert.run("Downtown Renovation", "Richard", "Jane Doe", 500, 25000);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:5173"],
    },
  });

  app.use(express.json());

  // ========== AUTH ROUTES ==========

  app.post("/api/login", (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      const valid = bcryptjs.compareSync(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Create session
      const token = uuidv4();
      db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, user.id);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          must_change_password: !!user.must_change_password,
        },
      });
    } catch (err: any) {
      console.error("POST /api/login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/change-password", (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const user = getUserFromToken(token);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
      }

      const hash = bcryptjs.hashSync(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hash, user.id);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          must_change_password: false,
        },
      });
    } catch (err: any) {
      console.error("POST /api/change-password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  app.get("/api/me", (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const user = getUserFromToken(token);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      res.json({ user });
    } catch (err: any) {
      console.error("GET /api/me error:", err);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/logout", (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("POST /api/logout error:", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // ========== PROJECT ROUTES (with auth) ==========

  app.get("/api/projects", (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const user = getUserFromToken(token);

      const matSummary = `
        SELECT p.*,
          COALESCE(SUM(CASE WHEN m.is_addon = 0 THEN 1 ELSE 0 END), 0) as mat_count,
          COALESCE(SUM(CASE WHEN m.is_addon = 1 THEN 1 ELSE 0 END), 0) as addon_count,
          COALESCE(SUM(m.quantity * m.labor_hours_per_unit), 0) as mat_labor_est,
          COALESCE(SUM(m.actual_labor_hours), 0) as mat_labor_actual
        FROM projects p
        LEFT JOIN materials m ON m.project_id = p.id
      `;

      let projects;
      if (user && user.role === 'manager') {
        projects = db.prepare(`
          ${matSummary}
          WHERE p.manager = ?
          AND (p.completed_at IS NULL OR p.completed_at > datetime('now', '-30 days'))
          GROUP BY p.id
          ORDER BY p.updated_at DESC
        `).all(user.username);
      } else {
        projects = db.prepare(`
          ${matSummary}
          WHERE p.completed_at IS NULL 
          OR p.completed_at > datetime('now', '-30 days')
          GROUP BY p.id
          ORDER BY p.updated_at DESC
        `).all();
      }
      res.json(projects);
    } catch (err) {
      console.error("GET /api/projects error:", err);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { name, manager, lead_name, est_labor_hours, est_material_cost, est_odc, deadline } = req.body;

      if (!name || !manager) {
        return res.status(400).json({ error: "Name and Manager are required" });
      }

      const result = db.prepare("INSERT INTO projects (name, manager, lead_name, est_labor_hours, est_material_cost, est_odc, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(name, manager, lead_name || '', est_labor_hours || 0, est_material_cost || 0, est_odc || 0, deadline);

      const newProject = db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid);
      io.emit("project:updated", newProject);
      res.json(newProject);
    } catch (err: any) {
      console.error("POST /api/projects error:", err);
      res.status(500).json({
        error: err.message || "Failed to create project",
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  app.put("/api/projects/:id", (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        manager,
        lead_name,
        est_labor_hours,
        used_labor_hours,
        est_material_cost,
        used_material_cost,
        est_odc,
        used_odc,
        completed_at,
        deadline
      } = req.body;

      db.prepare(`
        UPDATE projects 
        SET name = COALESCE(?, name),
            manager = COALESCE(?, manager),
            lead_name = COALESCE(?, lead_name),
            est_labor_hours = COALESCE(?, est_labor_hours),
            used_labor_hours = COALESCE(?, used_labor_hours),
            est_material_cost = COALESCE(?, est_material_cost),
            used_material_cost = COALESCE(?, used_material_cost),
            est_odc = COALESCE(?, est_odc),
            used_odc = COALESCE(?, used_odc),
            completed_at = COALESCE(?, completed_at),
            deadline = COALESCE(?, deadline),
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(name, manager, lead_name, est_labor_hours, used_labor_hours, est_material_cost, used_material_cost, est_odc, used_odc, completed_at, deadline, id);

      const updatedProject = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
      if (!updatedProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      io.emit("project:updated", updatedProject);
      res.json(updatedProject);
    } catch (err: any) {
      console.error("PUT /api/projects error:", err);
      res.status(500).json({
        error: err.message || "Failed to update project",
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
      io.emit("project:deleted", id);
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /api/projects error:", err);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ========== MATERIAL ROUTES ==========

  app.get("/api/projects/:id/materials", (req, res) => {
    try {
      const { id } = req.params;
      const materials = db.prepare("SELECT * FROM materials WHERE project_id = ? ORDER BY created_at ASC").all(id);
      res.json(materials);
    } catch (err: any) {
      console.error("GET /api/materials error:", err);
      res.status(500).json({ error: "Failed to fetch materials" });
    }
  });

  app.post("/api/projects/:id/materials", (req, res) => {
    try {
      const { id } = req.params;
      const { name, quantity, labor_hours_per_unit, unit_cost, is_addon } = req.body;
      if (!name) return res.status(400).json({ error: "Material name is required" });

      const result = db.prepare(
        "INSERT INTO materials (project_id, name, quantity, labor_hours_per_unit, unit_cost, is_addon) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(id, name, quantity || 1, labor_hours_per_unit || 0, unit_cost || 0, is_addon ? 1 : 0);

      // Touch project updated_at
      db.prepare("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

      const newMaterial = db.prepare("SELECT * FROM materials WHERE id = ?").get(result.lastInsertRowid);
      io.emit("material:updated", { projectId: id });
      res.json(newMaterial);
    } catch (err: any) {
      console.error("POST /api/materials error:", err);
      res.status(500).json({ error: err.message || "Failed to add material" });
    }
  });

  app.put("/api/materials/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, quantity, labor_hours_per_unit, unit_cost, quantity_used, actual_labor_hours, is_addon } = req.body;

      db.prepare(`
        UPDATE materials SET
          name = COALESCE(?, name),
          quantity = COALESCE(?, quantity),
          labor_hours_per_unit = COALESCE(?, labor_hours_per_unit),
          unit_cost = COALESCE(?, unit_cost),
          quantity_used = COALESCE(?, quantity_used),
          actual_labor_hours = COALESCE(?, actual_labor_hours),
          is_addon = COALESCE(?, is_addon)
        WHERE id = ?
      `).run(name, quantity, labor_hours_per_unit, unit_cost, quantity_used, actual_labor_hours, is_addon !== undefined ? (is_addon ? 1 : 0) : undefined, id);

      const updated = db.prepare("SELECT * FROM materials WHERE id = ?").get(id) as any;
      if (updated) {
        db.prepare("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(updated.project_id);
        io.emit("material:updated", { projectId: updated.project_id });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("PUT /api/materials error:", err);
      res.status(500).json({ error: err.message || "Failed to update material" });
    }
  });

  app.delete("/api/materials/:id", (req, res) => {
    try {
      const { id } = req.params;
      const mat = db.prepare("SELECT project_id FROM materials WHERE id = ?").get(id) as any;
      db.prepare("DELETE FROM materials WHERE id = ?").run(id);
      if (mat) {
        db.prepare("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(mat.project_id);
        io.emit("material:updated", { projectId: mat.project_id });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("DELETE /api/materials error:", err);
      res.status(500).json({ error: "Failed to delete material" });
    }
  });

  // Log installation / labor hours for a material
  app.post("/api/materials/:id/log-install", (req, res) => {
    try {
      const { id } = req.params;
      const { quantity_installed, labor_hours } = req.body;

      db.prepare(`
        UPDATE materials SET
          quantity_used = quantity_used + COALESCE(?, 0),
          actual_labor_hours = actual_labor_hours + COALESCE(?, 0)
        WHERE id = ?
      `).run(quantity_installed || 0, labor_hours || 0, id);

      const updated = db.prepare("SELECT * FROM materials WHERE id = ?").get(id) as any;
      if (updated) {
        db.prepare("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(updated.project_id);
        io.emit("material:updated", { projectId: updated.project_id });
      }
      res.json(updated);
    } catch (err: any) {
      console.error("POST /api/materials/log-install error:", err);
      res.status(500).json({ error: err.message || "Failed to log installation" });
    }
  });

  // Always serve built static files from dist/
  app.use(express.static(path.join(process.cwd(), "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist/index.html"));
  });

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
