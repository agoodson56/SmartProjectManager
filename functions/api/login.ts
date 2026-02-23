import { Env, getUserFromToken, getToken, jsonResponse } from "../_shared/auth";
import bcryptjs from "bcryptjs";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 60 seconds

function isRateLimited(username: string): boolean {
    const record = loginAttempts.get(username.toLowerCase());
    if (!record) return false;
    if (Date.now() - record.lastAttempt > LOCKOUT_MS) {
        loginAttempts.delete(username.toLowerCase());
        return false;
    }
    return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(username: string): void {
    const key = username.toLowerCase();
    const record = loginAttempts.get(key);
    if (!record || Date.now() - record.lastAttempt > LOCKOUT_MS) {
        loginAttempts.set(key, { count: 1, lastAttempt: Date.now() });
    } else {
        record.count++;
        record.lastAttempt = Date.now();
    }
}

function clearAttempts(username: string): void {
    loginAttempts.delete(username.toLowerCase());
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { username, password } = await context.request.json() as { username: string; password: string };

        if (!username || !password) {
            return jsonResponse({ error: "Username and password are required" }, 400);
        }

        // Fix #8: Rate limiting
        if (isRateLimited(username)) {
            return jsonResponse({ error: "Too many login attempts. Please wait 60 seconds." }, 429);
        }

        const user = await context.env.DB.prepare("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .first<{ id: number; username: string; password_hash: string; role: string; must_change_password: number }>();

        if (!user) {
            recordFailedAttempt(username);
            return jsonResponse({ error: "Invalid username or password" }, 401);
        }

        const valid = bcryptjs.compareSync(password, user.password_hash);
        if (!valid) {
            recordFailedAttempt(username);
            return jsonResponse({ error: "Invalid username or password" }, 401);
        }

        // Successful login — clear rate limiter
        clearAttempts(username);

        // Clean up expired sessions (older than 24h)
        await context.env.DB.prepare(
            "DELETE FROM sessions WHERE created_at < datetime('now', '-24 hours')"
        ).run();

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
