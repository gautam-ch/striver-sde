import { Resend } from "resend";
import nodemailer from "nodemailer";

function getEmailHtml(code) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="display: flex; align-items: center; margin-bottom: 24px;">
        <div style="background: #0f172a; color: white; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 16px;">
          t<span style="color: #ea580c;">u</span>f
        </div>
        <h2 style="margin: 0 0 0 12px; font-size: 18px; color: #0f172a;">Striver's SDE Sheet</h2>
      </div>
      <p style="color: #475569; font-size: 15px; margin-bottom: 16px;">
        Hello,
      </p>
      <p style="color: #475569; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
        Use the one-time verification code below to log in and sync your SDE Sheet progress across devices.
      </p>
      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ea580c; font-family: monospace;">
          ${code}
        </span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
        This code will expire in 10 minutes. If you did not request this login code, you can safely ignore this email.
      </p>
    </div>
  `;
}

export async function sendOtpEmail(email, code) {
  // Option 1: Gmail or standard SMTP (zero domain verification needed, works for any recipient)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"Striver's SDE Sheet" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Your Login Code: ${code} - Striver's SDE Sheet`,
        html: getEmailHtml(code),
      });

      console.log(`[SMTP] Successfully sent OTP to ${email}:`, info.messageId);
      return { success: true, devMode: false, provider: "smtp" };
    } catch (smtpErr) {
      console.error("[SMTP Error]:", smtpErr.message);
      // Fallback to dev mode if SMTP fails
      return { success: true, devMode: true, code, error: smtpErr.message };
    }
  }

  // Option 2: Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const fromEmail = process.env.EMAIL_FROM || "Strivers Sheet <onboarding@resend.dev>";

      const result = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `Your Login Code: ${code} - Striver's SDE Sheet`,
        html: getEmailHtml(code),
      });

      if (result.error) {
        console.warn("[Resend Warning]:", result.error.message);
        // Resend domain limitation or error: fallback to dev code
        console.log(`[DEV OTP FALLBACK] OTP for ${email}: ${code}`);
        return {
          success: true,
          devMode: true,
          code,
          warning: result.error.message,
        };
      }

      console.log(`[Resend] Successfully sent OTP to ${email}:`, result.data?.id);
      return { success: true, devMode: false, provider: "resend", result };
    } catch (err) {
      console.error("[Resend Error]:", err.message);
      console.log(`[DEV OTP FALLBACK] OTP for ${email}: ${code}`);
      return { success: true, devMode: true, code, error: err.message };
    }
  }

  // Option 3: Local Dev Fallback (logs to console and shows in UI)
  console.log(`\n========================================`);
  console.log(`[DEV MODE] OTP Generated for ${email}: ${code}`);
  console.log(`========================================\n`);
  return { success: true, devMode: true, code };
}
