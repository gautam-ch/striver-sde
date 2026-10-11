import { NextResponse } from "next/server";
import { authenticateOrRegister, getUserProgress } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, passcode } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Please enter your Email or User ID." },
        { status: 400 }
      );
    }

    if (!passcode || String(passcode).trim().length === 0) {
      return NextResponse.json(
        { error: "Please enter your secret Math PIN." },
        { status: 400 }
      );
    }

    const result = await authenticateOrRegister(email.trim(), passcode);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { user, isNew } = result;

    // Issue session cookie
    await setSessionCookie(user.id, user.email);

    // Retrieve existing cloud progress
    const progress = await getUserProgress(user.id);

    return NextResponse.json({
      success: true,
      message: isNew ? "Account created successfully!" : "Logged in successfully!",
      user: {
        id: user.id,
        email: user.email,
      },
      isNew,
      progress,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Failed to sign in. Please try again." },
      { status: 500 }
    );
  }
}
