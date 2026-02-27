import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";

// GET /api/projects — List projects (auth required)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const token = getToken(context.request);
    const user = await getUserFromToken(context.env.DB, token);
    if (!user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    let projects;
    if (user.role === "manager") {
      // Managers only see their own projects
      projects = await context.env.DB.prepare(`
        SELECT p.*, 
          COALESCE(ms.mat_labor_est, 0) as mat_labor_est,
          COALESCE(ms.mat_labor_actual, 0) as mat_labor_actual,
          COALESCE(ms.mat_count, 0) as mat_count,
          COALESCE(ms.addon_count, 0) as addon_count
        FROM projects p
        LEFT JOIN (
          SELECT project_id,
            SUM(quantity * labor_hours_per_unit) as mat_labor_est,
            SUM(actual_labor_hours) as mat_labor_actual,
            SUM(CASE WHEN is_addon = 0 THEN 1 ELSE 0 END) as mat_count,
            SUM(CASE WHEN is_addon = 1 THEN 1 ELSE 0 END) as addon_count
          FROM materials GROUP BY project_id
        ) ms ON ms.project_id = p.id
        WHERE p.manager = ?
        AND (p.completed_at IS NULL OR p.completed_at > datetime('now', '-30 days'))
        ORDER BY p.updated_at DESC
      `).bind(user.username).all();
    } else {
      // Admin sees all
      projects = await context.env.DB.prepare(`
        SELECT p.*,
          COALESCE(ms.mat_labor_est, 0) as mat_labor_est,
          COALESCE(ms.mat_labor_actual, 0) as mat_labor_actual,
          COALESCE(ms.mat_count, 0) as mat_count,
          COALESCE(ms.addon_count, 0) as addon_count
        FROM projects p
        LEFT JOIN (
          SELECT project_id,
            SUM(quantity * labor_hours_per_unit) as mat_labor_est,
            SUM(actual_labor_hours) as mat_labor_actual,
            SUM(CASE WHEN is_addon = 0 THEN 1 ELSE 0 END) as mat_count,
            SUM(CASE WHEN is_addon = 1 THEN 1 ELSE 0 END) as addon_count
          FROM materials GROUP BY project_id
        ) ms ON ms.project_id = p.id
        WHERE p.completed_at IS NULL 
        OR p.completed_at > datetime('now', '-30 days')
        ORDER BY p.updated_at DESC
      `).all();
    }
    return jsonResponse(projects.results);
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return jsonResponse({ error: "Failed to fetch projects" }, 500);
  }
};

// POST /api/projects — Create project (auth required, admin only)
// Accepts optional materials[] array to bulk-import materials on creation
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const token = getToken(context.request);
    const user = await getUserFromToken(context.env.DB, token);
    if (!user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }
    if (user.role !== "admin") {
      return jsonResponse({ error: "Only admins can create projects" }, 403);
    }

    const { name, manager, lead_name, est_labor_hours, est_material_cost, est_odc, deadline, materials } =
      await context.request.json() as any;

    if (!name || !manager) {
      return jsonResponse({ error: "Name and Manager are required" }, 400);
    }

    // If materials are provided, auto-calculate est_labor_hours from material sum
    let laborHours = est_labor_hours || 0;
    if (Array.isArray(materials) && materials.length > 0) {
      laborHours = materials.reduce((sum: number, m: any) => {
        return sum + ((parseFloat(m.quantity) || 0) * (parseFloat(m.labor_hours_per_unit) || 0));
      }, 0);
    }

    const result = await context.env.DB.prepare(
      "INSERT INTO projects (name, manager, lead_name, est_labor_hours, est_material_cost, est_odc, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(name, manager, lead_name || "", laborHours, est_material_cost || 0, est_odc || 0, deadline || null)
      .run();

    const projectId = result.meta.last_row_id;

    // Bulk-insert materials if provided
    if (Array.isArray(materials) && materials.length > 0) {
      for (const mat of materials) {
        if (!mat.name || !mat.quantity || !mat.labor_hours_per_unit) continue;
        await context.env.DB.prepare(
          "INSERT INTO materials (project_id, name, quantity, labor_hours_per_unit, unit_cost, is_addon) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          projectId,
          mat.name,
          parseFloat(mat.quantity) || 0,
          parseFloat(mat.labor_hours_per_unit) || 0,
          0,
          mat.is_addon ? 1 : 0
        ).run();
      }
    }

    const newProject = await context.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
      .bind(projectId)
      .first();

    return jsonResponse(newProject);
  } catch (err: any) {
    console.error("POST /api/projects error:", err);
    return jsonResponse({ error: "Failed to create project" }, 500);
  }
};
