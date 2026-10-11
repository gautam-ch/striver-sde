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
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        service: process.env.SMTP_SERVICE || "gmail",
        host: process.env.SMTP_HOST || undefined,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user,
          pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Striver's SDE Sheet" <${user}>`,
        to: email,
        subject: `Your Login Code: ${code} - Striver's SDE Sheet`,
        html: getEmailHtml(code),
      });

      console.log(`[Nodemailer] Successfully sent OTP to ${email}:`, info.messageId);
      return { success: true, devMode: false, messageId: info.messageId };
    } catch (err) {
      console.error("[Nodemailer Error]:", err.message);
      // Fallback to dev mode so user is never locked out
      return { success: true, devMode: true, code, error: err.message };
    }
  }

  // If SMTP is not yet configured, log to console and allow dev mode autofill
  console.log(`\n========================================`);
  console.log(`[Nodemailer Dev Mode] OTP for ${email}: ${code}`);
  console.log(`To send real emails to anyone, configure SMTP_USER and SMTP_PASS in .env`);
  console.log(`========================================\n`);
  return { success: true, devMode: true, code };
}
