# Striver's SDE Sheet (Classic Edition) with Math PIN Sync

A faithful, modern recreation of the beloved classic **TakeUForward Striver's SDE Sheet** with clean UI, full 191 problem dataset, local browser persistence, and **Vercel Postgres / Neon cloud synchronization using a fun, memorable Math PIN (no emails, no passwords, no verification required)**.

---

## ✨ Features

- **All 191 Questions & 27 Sections**: 100% exact question dataset extracted from the classic Striver's SDE sheet.
- **Classic UI**: Recreated the signature TakeUForward design (clean light theme, sidebar, progress card, accordions).
- **🧮 Memorable Math PIN Account**:
  - Sign in with an Email or Username + a secret Math PIN.
  - Interactive PIN formula: `(Birth Year) + (Phone Last 2 Digits) + (Cricketer Jersey No.) = Secret PIN`.
  - Zero external email services, zero spam, zero passwords, and zero domain verification.
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

---

## 🌐 Deploying to Vercel

### 1. Database (Vercel Postgres / Neon)
1. Push this project to GitHub and import it into **Vercel**.
2. In your Vercel project dashboard, go to the **Storage** tab.
3. Click **Create Database** and select **Postgres** (powered by Neon).
4. Connect it to your project. Vercel will automatically set the `POSTGRES_URL` environment variable. The app will automatically initialize the necessary tables (`users`, `user_progress`) on first run!

### 2. Environment Variables
In your Vercel Project Settings $\rightarrow$ **Environment Variables**, you only need:
- `JWT_SECRET`: Any random 32+ character string
