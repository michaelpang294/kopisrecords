# Kopi’s Records — Spaceship production deployment

Prepared 3 November 2026 from your final `kopisrecords - Copy.zip`.

The kit contains two files for upload and one cleaned source archive for your computer:

| File | Extract its contents into |
| --- | --- |
| `01-frontend-upload.zip` | `/home/jzzfhxgewz/kopisrecords.shop/` |
| `02-backend-upload.zip` | `/home/jzzfhxgewz/kopisrecords-api/` |
| `03-updated-source.zip` | Your local working project, keeping your local `server/.env` |

These are the paths shown in your earlier cPanel setup. In cPanel → Domains, confirm the document root for `kopisrecords.shop`; use that actual root if it has changed. The backend stays outside the website document root. Extract each upload ZIP directly into its destination: `index.html` belongs directly in the domain folder, and `app.cjs` directly in `kopisrecords-api`.

The outer kit and the source archive are for your computer. Upload the two numbered upload archives to their respective folders.

## 1. Back up the current live site

In File Manager, back up the domain folder and backend folder, including their existing configuration. Store server-side backups outside the website document root or download them to your computer. In phpMyAdmin, select the current production database and use Export → Quick → SQL.

Keep the current live database and its stock/orders. Your uploaded source ZIP contains no database dump. This release creates the additional application tables automatically. Changes made only in your local MySQL database are separate from this code upload.

Do the short code cutover during a quiet period. In Setup Node.js App, stop the existing app while replacing backend files.

## 2. Upload the backend

Upload `02-backend-upload.zip` inside `kopisrecords-api`, then Extract there. Replace matching code files. Preserve the existing `.env`, `node_modules` link, `tmp`, and any existing cover files that are not in this archive.

The resulting folder must contain `app.cjs`, `server.mjs`, `package.json`, `runtime.mjs`, `worker.mjs`, `run-jobs.sh` and the other application modules. Avoid an extra nested backend folder.

In File Manager → Settings, enable Show Hidden Files so you can edit `.env` and inspect `.htaccess` files.

## 3. Set the live environment

Edit `/home/jzzfhxgewz/kopisrecords-api/.env`. If the file is absent, copy `production.env.example` in that folder and name the copy `.env`.

Keep the working Spaceship database settings. The names from your earlier setup were `jzzfhxgewz_kopisrecords` and `jzzfhxgewz_kopisapp`; use the actual existing names if different. Set the database password to the existing hosting database user’s password.

Set these public configuration values exactly:

```env
NODE_ENV=production
BACKGROUND_MODE=cron
DB_HOST=localhost
DB_PORT=3306
DB_USER=jzzfhxgewz_kopisapp
DB_NAME=jzzfhxgewz_kopisrecords
FRONTEND_ORIGINS=https://kopisrecords.shop,https://www.kopisrecords.shop
PUBLIC_API_URL=https://kopisrecords.shop/api
ORDER_SITE_URL=https://kopisrecords.shop
RESTOCK_REQUIRE_CONFIRMATION=1
```

Fill these three private values in `.env`:

```env
DB_PASSWORD="YOUR_EXISTING_SPACESHIP_DATABASE_PASSWORD"
ADMIN_PASSWORD_HASH="THE_FULL_scrypt:..._VALUE_FROM_YOUR_WORKING_LOCAL_server/.env"
GMAIL_APP_PASSWORD="YOUR_WORKING_GOOGLE_APP_PASSWORD"
```

For the last two, copy the actual values from your working local `server/.env`. The admin hash preserves the admin password you already use. Keep quotes around secret values in the file. Set `.env` permissions to 0600 in File Manager.

If any of these keys already exist under the Node.js app’s Environment variables, make their values match this file; cPanel-provided environment values take precedence. This private file is required because cron does not inherit the Node.js app’s environment variables.

## 4. Configure and check the Node.js app

Open the existing app in cPanel → Setup Node.js App:

| Setting | Value |
| --- | --- |
| Node.js version | 22.x, as in your existing app |
| Application mode | Production |
| Application root | `kopisrecords-api` |
| Application URL | `kopisrecords.shop` with path `api` |
| Application startup file | `app.cjs` |

Save, then Run NPM Install. Allow installation to finish. The package now includes Nodemailer and all other backend dependencies.

Use cPanel Terminal, or SSH if Terminal is unavailable. Copy the activation command shown at the top of the Node.js app page. For your existing layout it should resemble:

```bash
source /home/jzzfhxgewz/nodevenv/kopisrecords-api/22/bin/activate
cd /home/jzzfhxgewz/kopisrecords-api
npm run check:production
```

This command checks configuration, connects to your existing database, creates the additional application tables, checks UTC handling and verifies Gmail SMTP authentication. It does not send an email or import/replace stock.

Expected final messages include `Gmail SMTP authentication verified; no email was sent.` and `Production checks passed.` Fix any reported setting/connection error before continuing. If your Node.js page offers Run JS script, `check:production` is the equivalent package script.

Click Restart in Setup Node.js App. Open:

https://kopisrecords.shop/api/health

Expected response:

```json
{"status":"ok","database":"connected"}
```

Also check https://kopisrecords.shop/api/stock. Confirm existing products and images are present. Local `/covers/...` and localhost cover URLs are translated to the hosted API path; matching image files must exist in the backend covers folder.

## 5. Upload the frontend

Upload `01-frontend-upload.zip` inside `/home/jzzfhxgewz/kopisrecords.shop/` and extract there. Replace matching frontend files, including `index.html`, and merge the new assets.

Keep the existing `api` directory and its cPanel-generated `.htaccess`. Existing older hashed assets can remain so open browser tabs can finish loading during the update.

The frontend archive contains React routing rules in the root `.htaccess`. If your existing root `.htaccess` contains a cPanel/Passenger-generated block, preserve that block when merging the supplied routing rules. The `/api` exclusion must remain ahead of the React fallback. Keep any existing domain-verification folders such as `.well-known`.

Remove the uploaded upload ZIPs after extraction. Hard-refresh the website with Ctrl+F5. Check the homepage, shop, product pages, blog, request page and `/admin`. Refresh a deep URL such as `/blog/welcome-to-kopis-records`: it should load the page rather than a server 404.

## 6. Add the background cron job

In cPanel → Cron Jobs, add one job with:

| Field | Value |
| --- | --- |
| Minute | `*/5` |
| Hour | `*` |
| Day | `*` |
| Month | `*` |
| Weekday | `*` |

Command:

```bash
/bin/bash /home/jzzfhxgewz/kopisrecords-api/run-jobs.sh >> /home/jzzfhxgewz/kopisrecords-api/jobs.log 2>&1
```

The script activates the same Node.js 22 environment and runs a finite queue/expiry check. It exits after the batch; a database lock prevents overlapping cron runs. If the activation line at the top of your Node.js app uses a different path, edit `TASK_ACTIVATE` in `run-jobs.sh` to that exact activation-file path.

Spaceship’s shared-hosting AUP requires cron intervals of at least five minutes. Passenger may stop idle application processes, so this job provides background processing even when nobody is browsing. User actions also trigger immediate queue checks; the cron job is the fallback for idle periods and retries.

From the activated Terminal environment you can test a run with:

```bash
cd /home/jzzfhxgewz/kopisrecords-api
npm run jobs
```

Inspect `jobs.log` after the next scheduled run. A successful run logs `Background email and expiry checks completed.` Timestamps are UTC. Gmail errors are logged by error code without passwords.

## 7. Check the customer flows

Use your own email and a controlled test product/order:

- Request a record: verify its acknowledgement and that the request appears in admin.
- Restock alert: set the test record to sold out, sign up, open the confirmation email and press Confirm stock alert. Then make a copy available in admin and verify the single back-in-stock email and product link. Production signups require email confirmation before availability mail; old unverified waiting rows need a fresh signup/confirmation.
- Checkout: verify required email, phone and Telegram fields. Report payment and check the customer review email and shop notification. Confirm payment only after matching an actual bank receipt, then verify the customer confirmation.
- Collection: enter the bag number when marking ready; check its email and the private order page. Mark completed after handover and check the final thank-you email.
- Delivery: mark dispatched after handing the parcel to the courier; verify the 2–3 day email. Mark completed after delivery and verify the final thank-you email.
- Reopen a private order link after closing the original checkout tab. Check the admin list and refresh an admin page; the new database sessions survive Passenger process changes.

No Recent Orders history is restored. Customers continue to use their private links.

## Troubleshooting

- **503 at `/api/health`:** check `stderr.log` in the backend folder, the startup file, completed NPM installation and environment values. The preflight command identifies missing configuration and database problems.
- **API returns the website HTML:** the Node app URL/path must be `/api`, and the root rewrite rules must exclude `/api`. Preserve the generated `api/.htaccess` file.
- **Frontend routes 404 on refresh:** check the root `.htaccess` was extracted and is visible with Show Hidden Files.
- **Gmail `EAUTH`:** check the working Gmail App Password and account in the private backend configuration. `ETIMEDOUT`/`ECONNECTION` may indicate SMTP connectivity; ask Spaceship support to check outbound access to `smtp.gmail.com:465` from your hosting server. The preflight command tests this without sending mail.
- **Emails wait until you visit:** check the cron job, the activation path and `jobs.log`. Cron must run from the private backend directory with its `.env` available.
- **Images missing:** preserve existing covers and verify each database URL points to an existing image. Arbitrary third-party URLs are retained; unavailable external images cannot be restored by this code bundle.
- **Admin unavailable:** copy the full existing scrypt hash into `.env`, ensure cPanel values match, restart and sign in with your existing password. Older browser sessions need a fresh login after this upgrade.
- **Queued email stuck at `sending`:** check Gmail Sent before manual reconciliation. SMTP may have accepted it before a process stopped. The code avoids automatically resending ambiguous accepted jobs. Ordinary failed emails retry; order emails also retain the existing admin retry button.

## Rollback and future updates

If you need to roll back, stop the app, disable this cron job, restore the backed-up frontend/backend files, keep the correct production settings and restart. Preserve the current database; a code rollback does not require restoring an older database dump and losing newer orders.

Keep `03-updated-source.zip` as the base for your next edits. It contains the production runtime changes, the confirmation page and tests; merge it into your local project while keeping your local `.env`. Its `public/.htaccess` files are copied into future builds automatically. Frontend edits can be built with `npm run build`; upload the resulting `dist` contents to the domain root. Backend edits go to the private backend folder followed by Restart.

## Verification and sources

Production build, targeted frontend lint, 51 backend tests, the confirmation-page DOM checks and static asset checks passed. The approved HomePage source is byte-for-byte unchanged. The obsolete unused RecentOrdersPage was removed because its deleted imports prevented the final upload from compiling.

The checks used a simulated database/mail sender. The live Spaceship database, SMTP access, cPanel routing and real email delivery still need the checks above after you upload. Passwords, `.env` backups, Git history and node_modules are excluded from all three archives.

Provider references checked 3 November 2026:

- https://www.spaceship.com/knowledgebase/setup-nodejs-application-spaceship-hosting/
- https://www.spaceship.com/legal/hosting-aup/
- https://www.phusionpassenger.com/docs/references/config_reference/apache/#passengerpoolidletime
