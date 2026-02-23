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

export async function getUserFromToken(db: D1Database, token: string | null): Promise<UserRecord | null> {
    if (!token) return null;
    const session = await db.prepare("SELECT user_id FROM sessions WHERE token = ?").bind(token).first<{ user_id: number }>();
    if (!session) return null;
    const user = await db.prepare("SELECT id, username, role, must_change_password FROM users WHERE id = ?").bind(session.user_id).first<UserRecord>();
    return user || null;
}

export function getToken(request: Request): string | null {
    const auth = request.headers.get("Authorization");
    if (!auth) return null;
    return auth.replace("Bearer ", "");
}

export function jsonResponse(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
