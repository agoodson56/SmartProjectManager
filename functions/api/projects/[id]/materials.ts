import { Env, getUserFromToken, getToken, jsonResponse } from "../../../_shared/auth";

// GET /api/projects/:id/materials — List all materials for a project
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

        const projectId = context.params.id;

        // Verify project exists and user has access
        const project = await context.env.DB.prepare("SELECT manager FROM projects WHERE id = ?")
            .bind(projectId).first<{ manager: string }>();
        if (!project) return jsonResponse({ error: "Project not found" }, 404);
        if (user.role !== "admin" && project.manager !== user.username) {
            return jsonResponse({ error: "Access denied" }, 403);
        }

        const materials = await context.env.DB.prepare(
            "SELECT * FROM materials WHERE project_id = ? ORDER BY created_at ASC"
        ).bind(projectId).all();

        return jsonResponse(materials.results);
    } catch (err) {
        console.error("GET materials error:", err);
        return jsonResponse({ error: "Failed to fetch materials" }, 500);
    }
};

// POST /api/projects/:id/materials — Add a new material
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

        const projectId = context.params.id;

        const project = await context.env.DB.prepare("SELECT manager FROM projects WHERE id = ?")
            .bind(projectId).first<{ manager: string }>();
        if (!project) return jsonResponse({ error: "Project not found" }, 404);
        if (user.role !== "admin" && project.manager !== user.username) {
            return jsonResponse({ error: "Access denied" }, 403);
        }

        const { name, quantity, labor_hours_per_unit, is_addon } = await context.request.json() as any;
        if (!name || !quantity || quantity <= 0 || !labor_hours_per_unit || labor_hours_per_unit <= 0) {
            return jsonResponse({ error: "Name, quantity, and labor hours per unit are required" }, 400);
        }

        const result = await context.env.DB.prepare(
            "INSERT INTO materials (project_id, name, quantity, labor_hours_per_unit, is_addon) VALUES (?, ?, ?, ?, ?)"
        ).bind(projectId, name, quantity, labor_hours_per_unit, is_addon ? 1 : 0).run();

        const newMaterial = await context.env.DB.prepare("SELECT * FROM materials WHERE id = ?")
            .bind(result.meta.last_row_id).first();

        return jsonResponse(newMaterial, 201);
    } catch (err) {
        console.error("POST materials error:", err);
        return jsonResponse({ error: "Failed to add material" }, 500);
    }
};
