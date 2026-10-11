import { NextResponse } from "next/server";
import { authenticateOrRegister, getUserProgress } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body.email;
    const pin = body.pin || body.passcode;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const cleanPin = String(pin || "").trim();
    if (!cleanPin || !/^\d{6}$/.test(cleanPin)) {
      return NextResponse.json(
        { error: "Please enter a valid 6-digit numeric PIN." },
        { status: 400 }
      );
    }

    const result = await authenticateOrRegister(email.trim(), cleanPin);

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
