import { Env, jsonResponse } from "../_shared/auth";
import bcryptjs from "bcryptjs";

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { username, password } = await context.request.json() as { username: string; password: string };

        if (!username || !password) {
            return jsonResponse({ error: "Username and password are required" }, 400);
        }

        const user = await context.env.DB.prepare("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .first<{ id: number; username: string; password_hash: string; role: string; must_change_password: number }>();

        if (!user) {
            return jsonResponse({ error: "Invalid username or password" }, 401);
        }

        const valid = bcryptjs.compareSync(password, user.password_hash);
        if (!valid) {
            return jsonResponse({ error: "Invalid username or password" }, 401);
        }

        // Create session token
        const token = crypto.randomUUID();
        await context.env.DB.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)")
            .bind(token, user.id)
            .run();

        return jsonResponse({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                must_change_password: !!user.must_change_password,
            },
        });
    } catch (err: any) {
        console.error("POST /api/login error:", err);
        return jsonResponse({ error: "Login failed" }, 500);
    }
};
