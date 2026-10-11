import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// If a PostgreSQL connection string exists, use Neon serverless
const sql = connectionString ? neon(connectionString) : null;

// File fallback path for local development when DB env is not provided
const LOCAL_DB_PATH = path.join(process.cwd(), "data", "local_db.json");

function getLocalData() {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const initial = { users: [], otps: [], progress: {} };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Local DB read error:", err);
    return { users: [], otps: [], progress: {} };
  }
}

function saveLocalData(data) {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Local DB write error:", err);
  }
}

// Ensure database tables exist if running on Neon Postgres
let initializedTables = false;
async function ensureTables() {
  if (!sql || initializedTables) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        done_ids JSONB DEFAULT '[]'::jsonb,
        starred_ids JSONB DEFAULT '[]'::jsonb,
        notes JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    initializedTables = true;
  } catch (err) {
    console.error("Error ensuring tables:", err);
  }
}

/**
 * Find a user by email
 */
export async function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  if (sql) {
    await ensureTables();
    const rows = await sql`SELECT * FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    return rows[0] || null;
  } else {
    const data = getLocalData();
    return data.users.find((u) => u.email === normalizedEmail) || null;
  }
}

/**
 * Create a new user
 */
export async function createUser(email) {
  const normalizedEmail = email.trim().toLowerCase();

  if (sql) {
    await ensureTables();
    const rows = await sql`
      INSERT INTO users (email) 
      VALUES (${normalizedEmail}) 
      ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    return rows[0];
  } else {
    const data = getLocalData();
    let existing = data.users.find((u) => u.email === normalizedEmail);
    if (!existing) {
      existing = {
        id: data.users.length + 1,
        email: normalizedEmail,
        created_at: new Date().toISOString(),
      };
      data.users.push(existing);
      saveLocalData(data);
    }
    return existing;
  }
}

/**
 * Save an OTP code for an email with expiration
 */
export async function saveOtp(email, code, expiresInMinutes = 10) {
  const normalizedEmail = email.trim().toLowerCase();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  if (sql) {
    await ensureTables();
    // Delete any previous OTPs for this email
    await sql`DELETE FROM otps WHERE email = ${normalizedEmail}`;
    const rows = await sql`
      INSERT INTO otps (email, code, expires_at)
      VALUES (${normalizedEmail}, ${code}, ${expiresAt.toISOString()})
      RETURNING *
    `;
    return rows[0];
  } else {
    const data = getLocalData();
    data.otps = data.otps.filter((o) => o.email !== normalizedEmail);
    const newOtp = {
      email: normalizedEmail,
      code,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    };
    data.otps.push(newOtp);
    saveLocalData(data);
    return newOtp;
  }
}

/**
 * Verify and consume an OTP code
 */
export async function verifyAndConsumeOtp(email, code) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = code.trim();

  if (sql) {
    await ensureTables();
    const rows = await sql`
      SELECT * FROM otps 
      WHERE email = ${normalizedEmail} AND code = ${trimmedCode} AND expires_at > NOW()
      ORDER BY id DESC LIMIT 1
    `;

    if (rows.length > 0) {
      // Invalidate OTP
      await sql`DELETE FROM otps WHERE email = ${normalizedEmail}`;
      return true;
    }
    return false;
  } else {
    const data = getLocalData();
    const idx = data.otps.findIndex(
      (o) =>
        o.email === normalizedEmail &&
        o.code === trimmedCode &&
        new Date(o.expires_at) > new Date()
    );

    if (idx !== -1) {
      data.otps.splice(idx, 1);
      saveLocalData(data);
      return true;
    }
    return false;
  }
}

/**
 * Get user progress by user ID
 */
export async function getUserProgress(userId) {
  if (sql) {
    await ensureTables();
    const rows = await sql`SELECT * FROM user_progress WHERE user_id = ${userId} LIMIT 1`;
    if (rows.length > 0) {
      const row = rows[0];
      return {
        done: Array.isArray(row.done_ids) ? row.done_ids : [],
        starred: Array.isArray(row.starred_ids) ? row.starred_ids : [],
        notes: typeof row.notes === "object" && row.notes !== null ? row.notes : {},
      };
    }
    return { done: [], starred: [], notes: {} };
  } else {
    const data = getLocalData();
    return data.progress[userId] || { done: [], starred: [], notes: {} };
  }
}

/**
 * Save user progress
 */
export async function saveUserProgress(userId, { done = [], starred = [], notes = {} }) {
  if (sql) {
    await ensureTables();
    await sql`
      INSERT INTO user_progress (user_id, done_ids, starred_ids, notes, updated_at)
      VALUES (${userId}, ${JSON.stringify(done)}, ${JSON.stringify(starred)}, ${JSON.stringify(notes)}, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        done_ids = EXCLUDED.done_ids,
        starred_ids = EXCLUDED.starred_ids,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `;
    return { done, starred, notes };
  } else {
    const data = getLocalData();
    data.progress[userId] = { done, starred, notes, updated_at: new Date().toISOString() };
    saveLocalData(data);
    return { done, starred, notes };
  }
}
