import { NextResponse } from "next/server";
import { saveOtp } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Generate 6-digit numerical code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in database with 10-minute validity
    await saveOtp(cleanEmail, code, 10);

    // Send email or log in dev mode
    const emailResult = await sendOtpEmail(cleanEmail, code);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
      devOtp: emailResult.devMode ? emailResult.code : undefined,
    });
  } catch (error) {
    console.error("send-otp error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
