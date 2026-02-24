import { Env, getUserFromToken, getToken, jsonResponse } from "../../../../_shared/auth";

// PUT /api/projects/:id/materials/:materialId — Update quantity_used
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

        const { quantity_used } = await context.request.json() as { quantity_used: number };
        if (quantity_used === undefined || quantity_used < 0) {
            return jsonResponse({ error: "Valid quantity_used is required" }, 400);
        }

        await context.env.DB.prepare(
            "UPDATE materials SET quantity_used = ? WHERE id = ? AND project_id = ?"
        ).bind(quantity_used, materialId, projectId).run();

        const updated = await context.env.DB.prepare("SELECT * FROM materials WHERE id = ?")
            .bind(materialId).first();
        if (!updated) return jsonResponse({ error: "Material not found" }, 404);

        return jsonResponse(updated);
    } catch (err) {
        console.error("PUT material error:", err);
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
