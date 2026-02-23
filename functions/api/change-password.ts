import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";
import bcryptjs from "bcryptjs";

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) {
            return jsonResponse({ error: "Not authenticated" }, 401);
        }

        const { newPassword } = await context.request.json() as { newPassword: string };
        if (!newPassword || newPassword.length < 4) {
            return jsonResponse({ error: "Password must be at least 4 characters" }, 400);
        }

        const hash = bcryptjs.hashSync(newPassword, 10);
        await context.env.DB.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
            .bind(hash, user.id)
            .run();

        return jsonResponse({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                must_change_password: false,
            },
        });
    } catch (err: any) {
        console.error("POST /api/change-password error:", err);
        return jsonResponse({ error: "Failed to change password" }, 500);
    }
};
