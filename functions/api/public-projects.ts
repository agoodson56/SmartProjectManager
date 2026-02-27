import { Env, jsonResponse } from "../_shared/auth";

// GET /api/public-projects — List all active projects (no auth required)
// Used by the public dashboard view so anyone can see project status
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const projects = await context.env.DB.prepare(`
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

        return jsonResponse(projects.results);
    } catch (err) {
        console.error("GET /api/public-projects error:", err);
        return jsonResponse({ error: "Failed to fetch projects" }, 500);
    }
};
