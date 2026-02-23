// Shared auth helper for Cloudflare Pages Functions

export interface Env {
    DB: D1Database;
}

export interface UserRecord {
    id: number;
    username: string;
    role: string;
    must_change_password: number;
}

// Session TTL: 24 hours in seconds
const SESSION_TTL_HOURS = 24;

export async function getUserFromToken(db: D1Database, token: string | null): Promise<UserRecord | null> {
    if (!token) return null;
    const session = await db.prepare(
        "SELECT user_id, created_at FROM sessions WHERE token = ?"
    ).bind(token).first<{ user_id: number; created_at: string }>();
    if (!session) return null;

    // Fix #3: Check session expiry (24h TTL)
    const created = new Date(session.created_at + "Z").getTime();
    const now = Date.now();
    if (now - created > SESSION_TTL_HOURS * 60 * 60 * 1000) {
        // Session expired — delete it and reject
        await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
        return null;
    }

    const user = await db.prepare(
        "SELECT id, username, role, must_change_password FROM users WHERE id = ?"
    ).bind(session.user_id).first<UserRecord>();
    return user || null;
}

export function getToken(request: Request): string | null {
    const auth = request.headers.get("Authorization");
    if (!auth) return null;
    return auth.replace("Bearer ", "");
}

// Fix #6: Security headers on every JSON response
export function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        },
    });
}
