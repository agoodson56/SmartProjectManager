import { Env, getUserFromToken, getToken, jsonResponse } from "../../../../_shared/auth";

// PUT /api/projects/:id/materials/:materialId — Log daily install
// Accepts: { add_qty: number, add_hours: number }
// Increments quantity_used and actual_labor_hours, also adds hours to project's used_labor_hours
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

        const projectId = context.params.id;
        const materialId = context.params.materialId;

        const project = await context.env.DB.prepare("SELECT manager FROM projects WHERE id = ?")
            .bind(projectId).first<{ manager: string }>();
        if (!project) return jsonResponse({ error: "Project not found" }, 404);
        if (user.role !== "admin" && project.manager !== user.username) {
            return jsonResponse({ error: "Access denied" }, 403);
        }

        const body = await context.request.json() as any;
        const addQty = parseFloat(body.add_qty) || 0;
        const addHours = parseFloat(body.add_hours) || 0;

        if (addQty <= 0 && addHours <= 0) {
            return jsonResponse({ error: "Provide quantity installed and/or hours worked" }, 400);
        }

        // Increment material quantities
        await context.env.DB.prepare(
            "UPDATE materials SET quantity_used = quantity_used + ?, actual_labor_hours = actual_labor_hours + ? WHERE id = ? AND project_id = ?"
        ).bind(addQty, addHours, materialId, projectId).run();

        // Also add the hours to the project's used_labor_hours
        if (addHours > 0) {
            await context.env.DB.prepare(
                "UPDATE projects SET used_labor_hours = used_labor_hours + ?, updated_at = datetime('now') WHERE id = ?"
            ).bind(addHours, projectId).run();
        }

        const updated = await context.env.DB.prepare("SELECT * FROM materials WHERE id = ?")
            .bind(materialId).first();
        if (!updated) return jsonResponse({ error: "Material not found" }, 404);

        return jsonResponse(updated);
    } catch (err) {
        console.error("PUT material error:", err);
        return jsonResponse({ error: "Failed to update material" }, 500);
    }
};

// PATCH /api/projects/:id/materials/:materialId — Edit material fields (name, quantity, labor, cost)
export const onRequestPatch: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

        const projectId = context.params.id;
        const materialId = context.params.materialId;

        const project = await context.env.DB.prepare("SELECT manager FROM projects WHERE id = ?")
            .bind(projectId).first<{ manager: string }>();
        if (!project) return jsonResponse({ error: "Project not found" }, 404);
        if (user.role !== "admin" && project.manager !== user.username) {
            return jsonResponse({ error: "Access denied" }, 403);
        }

        const body = await context.request.json() as any;

        // Build dynamic SET clause from provided fields
        const allowedFields = ['name', 'quantity', 'labor_hours_per_unit', 'unit_cost'] as const;
        const updates: string[] = [];
        const values: any[] = [];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(field === 'name' ? String(body[field]) : parseFloat(body[field]) || 0);
            }
        }

        if (updates.length === 0) {
            return jsonResponse({ error: "No fields to update" }, 400);
        }

        values.push(materialId, projectId);
        await context.env.DB.prepare(
            `UPDATE materials SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`
        ).bind(...values).run();

        // Touch project updated_at
        await context.env.DB.prepare(
            "UPDATE projects SET updated_at = datetime('now') WHERE id = ?"
        ).bind(projectId).run();

        const updated = await context.env.DB.prepare("SELECT * FROM materials WHERE id = ?")
            .bind(materialId).first();
        if (!updated) return jsonResponse({ error: "Material not found" }, 404);

        return jsonResponse(updated);
    } catch (err) {
        console.error("PATCH material error:", err);
        return jsonResponse({ error: "Failed to update material" }, 500);
    }
};

// DELETE /api/projects/:id/materials/:materialId — Remove a material
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

        const projectId = context.params.id;
        const materialId = context.params.materialId;

        const project = await context.env.DB.prepare("SELECT manager FROM projects WHERE id = ?")
            .bind(projectId).first<{ manager: string }>();
        if (!project) return jsonResponse({ error: "Project not found" }, 404);
        if (user.role !== "admin" && project.manager !== user.username) {
            return jsonResponse({ error: "Access denied" }, 403);
        }

        await context.env.DB.prepare(
            "DELETE FROM materials WHERE id = ? AND project_id = ?"
        ).bind(materialId, projectId).run();

        return jsonResponse({ success: true });
    } catch (err) {
        console.error("DELETE material error:", err);
        return jsonResponse({ error: "Failed to delete material" }, 500);
    }
};
