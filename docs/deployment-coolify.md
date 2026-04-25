# Coolify Self‑Hosted Deployment Plan

This plan outlines deploying the Driver Tracker app to a self‑hosted Coolify instance. It is the quickest way to get a test server up and running for live driver/admin testing.

## Prerequisites
- A virtual machine or bare‑metal server (Ubuntu 22.04 LTS recommended) with at least 1 GB RAM, 1 vCPU, and 10 GB disk.
- Docker Engine installed on the host (Coolify will manage containers via its agent).
- A Git repository (GitHub, GitLab, Bitbucket, etc.) accessible by the Coolify server.
- (Optional) A domain name pointing to the server’s IP for TLS via Let’s Encrypt.

## Step‑by‑Step

### 1. Install Coolify on the host
```bash
# As root or with sudo
curl -fsSL https://coolify.io/install.sh | sudo bash
```
The script will install Docker (if not present) and the Coolify agent. After installation, access the Coolify UI at `http://<server-ip>:8000` (or the port shown in the output) and complete the initial setup (create admin account, etc.).

### 2. Add a PostgreSQL resource (recommended)
Coolify can provision managed databases. For production‑like testing, add a PostgreSQL instance:
- In Coolify UI: **Resources → Add Resource → PostgreSQL**.
- Choose a version (e.g., 15), set a password, and optionally enable backups.
- Note the internal connection string (e.g., `postgresql://postgres:password@coolify-postgres:5432/postgres`).

### 3. Prepare environment variables
In Coolify, go to **Servers → [your server] → Resources → Environment Variables** (or set them per‑application). Add the following:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string. If using Coolify’s PostgreSQL resource, use the internal host. | `postgresql://postgres:coolifypassword@coolify-postgres:5432/postgres` |
| `NEXTAUTH_SECRET` | Random string for JWT signing. | `$(openssl rand -base64 32)` |
| `NEXTAUTH_URL` | Public URL of the app (used for Auth callbacks). | `https://driver-tracker.yourdomain.com` |
| `SETTINGS_ENCRYPTION_KEY` | 32‑byte key (raw or base64) for encrypting provider secrets. | `$(openssl rand -base64 32)` |
| `AUTO_SEED_ON_EMPTY_DB` | Set `true` to seed default users/locations on first start. | `true` |
| `MIGRATION_MAX_RETRIES` | Docker startup retry count for migrations (default `10`). | `10` |
| `MIGRATION_RETRY_DELAY_SECONDS` | Delay between retries (default `5`). | `5` |
| **Optional provider credentials** (for real email/SMS): | | |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `your_auth_token` |
| `TWILIO_FROM_NUMBER` | Twilio phone number in E.164 format | `+15017122661` |
| `EMAIL_TENANT_ID`, `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`, `EMAIL_FROM` | Microsoft Graph mail settings (if using email alerts). | – |

> **Tip:** For a quick test you can leave the provider fields blank; alerts will be logged to console.

### 4. Push your code to a Git repository
Ensure your local `main` branch is up‑to‑date and push:
```bash
git add .
git commit -m "Ready for Coolify deployment"
git push origin main
```
The repository must be accessible by the Coolify server (public or with a deploy key/token).

### 5. Add the application in Coolify
- In Coolify UI: **Applications → Add Application → Docker**.
- Connect your Git repository (provide the clone URL and any required authentication).
- Set the build path to `/` (root).
- Coolify will automatically detect the `Dockerfile` and use it.
- (Optional) Under **Build & Deploy Settings**, you can specify custom build commands, but the default works:
  - Build: `docker build -t driver-tracker .`
  - Start: `docker run -p 3000:3000 driver-tracker`
- Under **Environment Variables**, add the variables you prepared in step 3 (or import from a `.env` file if you have one).
- Under **Deploy Triggers**, enable **Automatic Deployments** on pushes to `main` if you want updates on every push.
- Click **Save & Deploy**.

### 6. Monitor the first deployment
- Go to the application’s **Logs** tab to see the build output.
- You should see:
  - Docker image build steps.
  - Prisma client generation.
  - Database migration (`prisma migrate deploy`).
  - Seeding (if `AUTO_SEED_ON_EMPTY_DB=true` and the DB is empty).
  - Next.js startup (`next start`) and the message `ready - started server on http://0.0.0.0:3000`.
- Once the logs indicate the app is ready, visit the URL you set in `NEXTAUTH_URL` (or the server’s IP with port 3000 if not using a reverse proxy).

### 7. Live testing
- **Driver flow**: Open the app on a mobile device or browser, perform check‑in/check‑out.
- **Admin flow**: Log in as an admin (default credentials from the seed: `admin@example.com` / `admin123`) and verify the dashboard, driver management, and notification settings.
- **SMS/Twilio**: If configured, test inbound/outbound SMS (use Twilio test credentials or real ones for live tests).
- **Notifications**: Trigger events that send emails/SMS and verify delivery.

### 8. Monitoring, backups, and rollback
- **Health checks**: Coolify provides built‑in health checks (you can add a simple `/api/health` route if desired).
- **Logs**: View real‑time logs in the UI; you can also forward them to an external system.
- **Snapshots/backups**: Coolify allows you to take snapshots of the application (including container image and configuration) for easy rollback.
- **Database backups**: If you used Coolify’s PostgreSQL resource, enable automated backups in the resource settings.
- **Rollback**: In the application’s **Deployments** tab, you can roll back to a previous successful deployment with one click.

## Quick‑Test Tips
- Use Coolify’s one‑click PostgreSQL to avoid managing an external DB.
- Share the test URL with a few drivers/admins for real‑world feedback.
- If you need to iterate quickly, enable automatic deployments and push to `main`; Coolify will rebuild and redeploy automatically.

## Notes
- The existing `Dockerfile` and `.dockerignore` in the repository are optimized for Coolify’s Docker builder.
- Ensure the host firewall allows inbound traffic on port 8000 (Coolify UI) and 3000 (app) or configure a reverse proxy (e.g., Caddy/Nginx) for TLS on ports 80/443.
- For production‑like workloads, consider increasing the host’s resources (CPU/RAM) and enabling Coolify’s built‑in scaling features (if available) or adding a load balancer.

---
*Plan generated on $(date). Adjust names, passwords, and resources to match your environment.*