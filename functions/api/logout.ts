import { Env, getToken, jsonResponse } from "../_shared/auth";

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        if (token) {
            await context.env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
        }
        return jsonResponse({ success: true });
    } catch (err: any) {
        console.error("POST /api/logout error:", err);
        return jsonResponse({ error: "Logout failed" }, 500);
    }
};
