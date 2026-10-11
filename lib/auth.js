import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "default_jwt_secret_takeuforward_sde_sheet_2026_xyz"
);

const COOKIE_NAME = "tuf_session";

/**
 * Sign a session token
 */
export async function signSession(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d") // 30-day session
    .sign(SECRET_KEY);
}

/**
 * Verify a session token
 */
export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Get the currently logged-in user from request cookies
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) return null;

    const payload = await verifySession(sessionCookie.value);
    if (!payload || !payload.userId) return null;

    return {
      id: payload.userId,
      email: payload.email,
    };
  } catch (e) {
    console.error("Error reading current user:", e);
    return null;
  }
}

/**
 * Set session cookie in response
 */
export async function setSessionCookie(userId, email) {
  const token = await signSession({ userId, email });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

/**
 * Remove session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
