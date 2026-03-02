import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";

// GET /api/settings — Public, returns all settings (no auth required)
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const rows = await context.env.DB.prepare(
            "SELECT key, value FROM settings"
        ).all<{ key: string; value: string }>();

        // Convert rows to a key-value object
        const settings: Record<string, string> = {};
        for (const row of rows.results) {
            settings[row.key] = row.value;
        }

        return jsonResponse(settings);
    } catch (err: any) {
        console.error("GET /api/settings error:", err);
        return jsonResponse({ error: "Failed to fetch settings" }, 500);
    }
};

// PUT /api/settings — Admin only, upserts a setting
export const onRequestPut: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) {
            return jsonResponse({ error: "Not authenticated" }, 401);
        }
        if (user.role !== "admin") {
            return jsonResponse({ error: "Admin access required" }, 403);
        }

        const body = await context.request.json() as { key: string; value: string };
        if (!body.key || body.value === undefined) {
            return jsonResponse({ error: "Missing key or value" }, 400);
        }

        await context.env.DB.prepare(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
        ).bind(body.key, String(body.value)).run();

        return jsonResponse({ ok: true, key: body.key, value: body.value });
    } catch (err: any) {
        console.error("PUT /api/settings error:", err);
        return jsonResponse({ error: "Failed to update setting" }, 500);
    }
};
