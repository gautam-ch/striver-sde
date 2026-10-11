# Striver's SDE Sheet (Classic Edition) with Email OTP Auth & Cloud Sync

A faithful, modern recreation of the beloved classic **TakeUForward Striver's SDE Sheet** with clean UI, full 191 problem dataset, local browser persistence, and **Vercel Postgres / Neon cloud synchronization with passwordless Email + OTP authentication**.

---

## ✨ Features

- **All 191 Questions & 27 Sections**: 100% exact question dataset extracted from the classic Striver's SDE sheet.
- **Classic UI**: Recreated the signature TakeUForward design (clean light theme, sidebar, progress card, accordions).
- **Passwordless Email + OTP Auth**:
  - Sign in with just your email address and a 6-digit OTP code (no passwords to remember).
  - Sends emails via **Resend** in production.
  - Automatic **Dev Mode** fallback for local testing without external API keys.
- **Cloud Progress Sync (Vercel Postgres / Neon)**:
  - Solved questions, revision stars, and personal notes are synchronized to your account in the cloud.
  - Automatic background debounced autosave.
  - Graceful fallback: when unauthenticated or offline, saves to browser `localStorage`.
- **⭐ Revision Mode**: Mark any question for revision and filter them with one click.
- **🎲 Random Problem Picker**: Automatically picks an unsolved question and highlights it.
- **📝 Personal Notes**: Save key intuition, tricky edge cases, and time/space complexity notes per problem.
- **💾 JSON Export & Import**: Backup or transfer your progress between devices at any time.

---

## 🚀 Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

> In local development mode, if no `RESEND_API_KEY` is provided, OTP codes are logged directly to the server console and displayed inside the UI modal with a one-click "Auto-fill & Login" helper.

---

## 🌐 Deploying to Vercel

### 1. Database (Vercel Postgres / Neon)
1. Push this project to GitHub and import it into **Vercel**.
2. In your Vercel project dashboard, go to the **Storage** tab.
3. Click **Create Database** and select **Postgres** (powered by Neon).
4. Connect it to your project. Vercel will automatically set the `POSTGRES_URL` environment variable. The app will automatically initialize the necessary tables (`users`, `otps`, `user_progress`) on first run!

### 2. Email Sending (Choose One)

#### Option A: Free Gmail SMTP (No Custom Domain Needed! 🎉)
If you don't own a custom domain, you can use any free Gmail account to send up to 500 emails/day to any recipient:
1. Go to your [Google Account Security](https://myaccount.google.com/security).
2. Enable 2-Step Verification if not already enabled.
3. Search for **"App Passwords"** and generate a new password (e.g., named "Strivers Sheet").
4. Add to your Vercel Environment Variables:
   - `SMTP_USER`: `your_email@gmail.com`
   - `SMTP_PASS`: `your_16_character_app_password`
   - `JWT_SECRET`: Any random 32+ character string

#### Option B: Resend (Requires Custom Domain for external users)
1. Sign up at [Resend](https://resend.com) and create an API Key.
2. In Vercel Environment Variables, add:
   - `RESEND_API_KEY`: `re_your_api_key_here`
   - `JWT_SECRET`: Any random 32+ character string
3. *Note:* If you haven't verified a custom domain on Resend, Resend will only send to your own registered email. If Resend blocks an external recipient, the app automatically falls back to displaying the OTP in the UI so the user can still log in!

