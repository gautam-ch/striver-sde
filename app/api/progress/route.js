import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProgress, saveUserProgress } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const progress = await getUserProgress(user.id);
    return NextResponse.json({ success: true, progress });
  } catch (error) {
    console.error("GET progress error:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { done = [], starred = [], notes = {} } = body;

    const saved = await saveUserProgress(user.id, {
      done: Array.isArray(done) ? done : [],
      starred: Array.isArray(starred) ? starred : [],
      notes: typeof notes === "object" && notes !== null ? notes : {},
    });

    return NextResponse.json({ success: true, progress: saved });
  } catch (error) {
    console.error("POST progress error:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
