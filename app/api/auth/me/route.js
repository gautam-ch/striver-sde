import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProgress } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const progress = await getUserProgress(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      progress,
    });
  } catch (error) {
    console.error("auth/me error:", error);
    return NextResponse.json({ user: null });
  }
}
