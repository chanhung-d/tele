# Telegram File Upload (GitHub Pages + Render)

Website upload file -> Render Node.js API -> Telegram Bot `sendDocument`.

## Important security choices
- The Telegram bot token is stored only in Render environment variables. It is never sent to the browser.
- Uploads require a shared password (`UPLOAD_PASSWORD`). Set a strong password and share it only with trusted users.
- The server accepts files up to **50,000,000 bytes (50 MB decimal)**.
- The server keeps the file in memory only long enough to send it to Telegram; it does not save uploads to disk.
- This starter project allows any file type. If you only need certain types, add an allowlist before public use.

## 1. Create a Telegram bot and get your Chat ID
1. In Telegram, open **@BotFather**, send `/newbot`, and follow the steps.
2. Copy the bot token. Keep it secret.
3. Send a message to your new bot (for a private chat), then open this URL in a browser, replacing `BOT_TOKEN`:
   `https://api.telegram.org/botBOT_TOKEN/getUpdates`
4. Find `message.chat.id` in the response. That number is your `CHAT_ID`.
   - For a group, add the bot to the group, send a message in the group, and use the group's chat ID (often negative).
   - If `getUpdates` is empty, send another message to the bot and refresh.

## 2. Deploy the backend to Render
1. Push this project to a GitHub repository.
2. In Render, choose **New + -> Web Service** and connect the repository.
3. Set:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add these environment variables in Render:
   - `BOT_TOKEN` = your Telegram bot token
   - `CHAT_ID` = destination chat ID
   - `UPLOAD_PASSWORD` = a strong password users must enter to upload
   - `FRONTEND_ORIGIN` = your GitHub Pages origin, e.g. `https://YOUR-USERNAME.github.io`
     - For a project site, the origin is still `https://YOUR-USERNAME.github.io` (no repository path).
   - `NODE_ENV` = `production`
5. Deploy. Copy your Render service URL, e.g. `https://your-service.onrender.com`.

The included `render.yaml` is optional; you can configure the service manually as above.

## 3. Configure the frontend and publish with GitHub Pages
1. Open `frontend/config.js`.
2. Replace `https://YOUR-RENDER-SERVICE.onrender.com` with your actual Render service URL. Do not add a trailing slash.
3. Push the changes to GitHub.
4. In your repository, open **Settings -> Pages**.
5. Under **Build and deployment**, choose **GitHub Actions**.
6. The included workflow `.github/workflows/pages.yml` publishes the `frontend/` folder.
7. Wait for the Pages workflow to finish. Your site URL will look like:
   `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`

## 4. Test
1. Open the GitHub Pages URL.
2. Enter the upload password configured as `UPLOAD_PASSWORD` on Render.
3. Select a file no larger than 50 MB and click **Send to Telegram**.
4. The file should arrive in the Telegram chat connected to `CHAT_ID`.

## Notes / limitations
- Render's free service may sleep when idle, so the first request after inactivity can take a while. Free-plan availability and limits can change.
- Telegram Bot API cloud uploads are limited to 50 MB per file. This project uses 50,000,000 bytes to stay within the decimal 50 MB ceiling.
- Uploads are subject to Render's request and memory limits. Avoid simultaneous large uploads.
- The upload password is a shared access gate, not individual user accounts. Use a long random password and rotate it if it is shared too widely.
- Do not commit `.env` files, bot tokens, passwords, or chat credentials to GitHub.
- This project does not provide malware scanning. Do not accept untrusted files for automatic opening or execution.

## Local development
Backend:
```bash
cd backend
cp .env.example .env
# Fill in BOT_TOKEN, CHAT_ID, UPLOAD_PASSWORD, FRONTEND_ORIGIN
npm install
npm start
```
Open `frontend/index.html` directly or serve the frontend with a local static server. For local browser testing, add `http://localhost:5500` to `FRONTEND_ORIGIN` and use a static server such as VS Code Live Server.
