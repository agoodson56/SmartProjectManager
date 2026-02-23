import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";
import bcryptjs from "bcryptjs";

// Fix #7: Strong password validation
function isStrongPassword(password: string): boolean {
    if (password.length < 8) return false;
    if (!/[a-zA-Z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const token = getToken(context.request);
        const user = await getUserFromToken(context.env.DB, token);
        if (!user) {
            return jsonResponse({ error: "Not authenticated" }, 401);
        }

        const { newPassword } = await context.request.json() as { newPassword: string };
        if (!newPassword || !isStrongPassword(newPassword)) {
            return jsonResponse({ error: "Password must be at least 8 characters with at least one letter and one number" }, 400);
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
