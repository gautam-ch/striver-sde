import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const rawConn = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const isValidPostgres =
  rawConn &&
  !rawConn.includes("ep-sample-pooler") &&
  !rawConn.includes("user:password") &&
  rawConn.startsWith("postgres");

// If a valid PostgreSQL connection string exists, use Neon serverless
const sql = isValidPostgres ? neon(rawConn) : null;

// File fallback path for local development when DB env is not provided
const LOCAL_DB_PATH = path.join(process.cwd(), "data", "local_db.json");

function hashPasscode(passcode) {
  return crypto.createHash("sha256").update(String(passcode).trim()).digest("hex");
}

function getLocalData() {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      const initial = { users: [], progress: {} };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2));
      return initial;
    }
    const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Local DB read error:", err);
    return { users: [], progress: {} };
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
        passcode_hash VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Add column if table already existed without it
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS passcode_hash VARCHAR(255);
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
 * Authenticate or create a user via Email + Math PIN
 */
export async function authenticateOrRegister(email, passcode) {
  const normalizedEmail = email.trim().toLowerCase();
  const hashed = hashPasscode(passcode);

  if (sql) {
    await ensureTables();
    const existing = await sql`SELECT * FROM users WHERE email = ${normalizedEmail} LIMIT 1`;
    if (existing.length > 0) {
      const user = existing[0];
      if (user.passcode_hash && user.passcode_hash !== hashed) {
        return { error: "Incorrect Math PIN for this account. Check your calculation!" };
      }
      // If passcode was not set before, update it
      if (!user.passcode_hash) {
        await sql`UPDATE users SET passcode_hash = ${hashed} WHERE id = ${user.id}`;
      }
      return { user, isNew: false };
    } else {
      // Create new user
      const inserted = await sql`
        INSERT INTO users (email, passcode_hash)
        VALUES (${normalizedEmail}, ${hashed})
        RETURNING *
      `;
      return { user: inserted[0], isNew: true };
    }
  } else {
    const data = getLocalData();
    let user = data.users.find((u) => u.email === normalizedEmail);

    if (user) {
      if (user.passcode_hash && user.passcode_hash !== hashed) {
        return { error: "Incorrect Math PIN for this account. Check your calculation!" };
      }
      if (!user.passcode_hash) {
        user.passcode_hash = hashed;
        saveLocalData(data);
      }
      return { user, isNew: false };
    } else {
      user = {
        id: data.users.length + 1,
        email: normalizedEmail,
        passcode_hash: hashed,
        created_at: new Date().toISOString(),
      };
      data.users.push(user);
      saveLocalData(data);
      return { user, isNew: true };
    }
  }
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
  if (sql) {
    await ensureTables();
    const rows = await sql`SELECT id, email, created_at FROM users WHERE id = ${id} LIMIT 1`;
    return rows[0] || null;
  } else {
    const data = getLocalData();
    return data.users.find((u) => u.id === id) || null;
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
