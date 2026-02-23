import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) {
            return jsonResponse({ error: "Not authenticated" }, 401);
        }
        return jsonResponse({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                must_change_password: !!user.must_change_password,
            },
        });
    } catch (err: any) {
        console.error("GET /api/me error:", err);
        return jsonResponse({ error: "Failed to get user" }, 500);
    }
};
