import { NextResponse } from "next/server";
import { verifyAndConsumeOtp, createUser, getUserProgress } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const isValid = await verifyAndConsumeOtp(cleanEmail, cleanCode);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    // Get or create user
    const user = await createUser(cleanEmail);

    // Set signed HTTP-only session cookie
    await setSessionCookie(user.id, user.email);

    // Fetch existing progress
    const progress = await getUserProgress(user.id);

    return NextResponse.json({
      success: true,
      message: "Successfully signed in!",
      user: {
        id: user.id,
        email: user.email,
      },
      progress,
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return NextResponse.json(
      { error: "Failed to verify code. Please try again." },
      { status: 500 }
    );
  }
}
