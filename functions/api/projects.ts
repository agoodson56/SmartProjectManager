import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";

// GET /api/projects — List projects
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);

        let projects;
        if (user && user.role === "manager") {
            projects = await context.env.DB.prepare(`
        SELECT * FROM projects 
        WHERE manager = ?
        AND (completed_at IS NULL OR completed_at > datetime('now', '-30 days'))
        ORDER BY updated_at DESC
      `).bind(user.username).all();
        } else {
            projects = await context.env.DB.prepare(`
        SELECT * FROM projects 
        WHERE completed_at IS NULL 
        OR completed_at > datetime('now', '-30 days')
        ORDER BY updated_at DESC
      `).all();
        }
        return jsonResponse(projects.results);
    } catch (err) {
        console.error("GET /api/projects error:", err);
        return jsonResponse({ error: "Failed to fetch projects" }, 500);
    }
};

// POST /api/projects — Create project
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { name, manager, lead_name, est_labor_hours, est_material_cost, est_odc, deadline } =
            await context.request.json() as any;

        if (!name || !manager) {
            return jsonResponse({ error: "Name and Manager are required" }, 400);
        }

        const result = await context.env.DB.prepare(
            "INSERT INTO projects (name, manager, lead_name, est_labor_hours, est_material_cost, est_odc, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
            .bind(name, manager, lead_name || "", est_labor_hours || 0, est_material_cost || 0, est_odc || 0, deadline || null)
            .run();

        const newProject = await context.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
            .bind(result.meta.last_row_id)
            .first();

        return jsonResponse(newProject);
    } catch (err: any) {
        console.error("POST /api/projects error:", err);
        return jsonResponse({ error: err.message || "Failed to create project" }, 500);
    }
};
