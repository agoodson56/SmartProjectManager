import { Env, jsonResponse } from "../../_shared/auth";

// PUT /api/projects/:id — Update project
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id;
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
            deadline,
        } = await context.request.json() as any;

        await context.env.DB.prepare(`
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
          updated_at = datetime('now')
      WHERE id = ?
    `)
            .bind(
                name ?? null, manager ?? null, lead_name ?? null,
                est_labor_hours ?? null, used_labor_hours ?? null,
                est_material_cost ?? null, used_material_cost ?? null,
                est_odc ?? null, used_odc ?? null,
                completed_at ?? null, deadline ?? null,
                id
            )
            .run();

        const updatedProject = await context.env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first();
        if (!updatedProject) {
            return jsonResponse({ error: "Project not found" }, 404);
        }
        return jsonResponse(updatedProject);
    } catch (err: any) {
        console.error("PUT /api/projects/:id error:", err);
        return jsonResponse({ error: err.message || "Failed to update project" }, 500);
    }
};

// DELETE /api/projects/:id — Delete project
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    try {
        const id = context.params.id;
        await context.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true });
    } catch (err) {
        console.error("DELETE /api/projects/:id error:", err);
        return jsonResponse({ error: "Failed to delete project" }, 500);
    }
};
