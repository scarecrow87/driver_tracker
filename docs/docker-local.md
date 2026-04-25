# Docker‑Only Local Server Deployment Plan

This plan describes how to run the Driver Tracker application on a bare‑metal or virtual machine using only Docker and Docker‑Compose. It is suitable for:

- A development or staging server that you manage yourself.
- A small production‑like instance where you want full control without extra platform layers (Coolify, Kubernetes, etc.).
- Environments where you already have Docker installed and want to keep the footprint minimal.

The existing `docker-compose.yml` and `Dockerfile` in the repository are already configured for this scenario.

---

## Prerequisites

| Item | Minimum version | Notes |
|------|----------------|-------|
| **OS** | Ubuntu 22.04 LTS (or any recent Linux with `systemd`) | The steps assume `apt`; adjust for your distro. |
| **Docker Engine** | 24.0+ | Install via the official Docker repository. |
| **Docker Compose** | v2 (the `docker compose` sub‑command) | Comes with Docker Engine ≥ 20.10; otherwise install the standalone plugin. |
| **Git** | Any | To pull the source code. |
| **Ports** | 3000 (HTTP) – optional 443 if you terminate TLS elsewhere | The app listens on `0.0.0.0:3000` inside the container. |
| **Resources** | 1 vCPU, 2 GB RAM, 10 GB disk (more if you expect many concurrent drivers) | Adjust based on expected load. |

---

## Step‑by‑Step Installation

### 1. Prepare the host

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker Engine (official repo)
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker version
docker compose version

# Optional: allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker   # or log out/in
```

### 2. Get the source code

```bash
# Choose a directory for the app, e.g., /opt/driver-tracker
sudo mkdir -p /opt/driver-tracker
sudo chown $USER:$USER /opt/driver-tracker
cd /opt/driver-tracker

# Clone your repository (replace with your actual URL)
git clone https://github.com/scarecrow87/driver_tracker.git .
# If you already have a local copy, just `cd` into it and ensure you're on the desired branch
git fetch origin
git checkout main   # or a release/tag
git pull
```

### 3. Configure environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
nano .env   # or your preferred editor
```

**Required variables (fill in with real values):**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string. If you let Compose start a DB, use the service name `db`. | `postgresql://postgres:password@db:5432/driver_tracker` |
| `NEXTAUTH_SECRET` | Random string used for JWT signing. | `$(openssl rand -base64 32)` |
| `NEXTAUTH_URL` | Base URL of the app (used for auth callbacks). | `http://localhost:3000` (or your domain) |
| `SETTINGS_ENCRYPTION_KEY` | 32‑byte key (raw or base64) for encrypting provider secrets. | `$(openssl rand -base64 32)` |
| `AUTO_SEED_ON_EMPTY_DB` | Set `true` to seed default users/locations on first start. | `true` |
| `MIGRATION_MAX_RETRIES` | Docker startup retry count for migrations (default `10`). | `10` |
| `MIGRATION_RETRY_DELAY_SECONDS` | Delay between retries (default `5`). | `5` |
| **Optional provider credentials** (only needed if you want real email/SMS): | | |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `your_auth_token` |
| `TWILIO_FROM_NUMBER` | Twilio phone number in E.164 format | `+15017122661` |
| `EMAIL_TENANT_ID`, `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`, `EMAIL_FROM` | Microsoft Graph mail settings (if using email alerts). | – |

> **Tip:** For a quick test you can leave the provider fields blank; alerts will be logged to console instead of being sent.

### 4. (Optional) Use an external PostgreSQL

If you prefer to run PostgreSQL outside Compose (managed service, existing server, etc.):

1. Ensure the database is reachable from the host.
2. Set `DATABASE_URL` accordingly in `.env`.
3. Comment out the `db` service in `docker-compose.yml` (or remove it) so Compose does not try to start a duplicate container.

### 5. Start the stack

```bash
# From the project root (where docker-compose.yml lives)
docker compose up -d
```

Compose will:

- Build the Next.js image (using the provided `Dockerfile`).
- Start the PostgreSQL container (if you kept the `db` service).
- Run the entrypoint script, which:
  - Waits for the DB to be healthy.
  - Executes `prisma migrate deploy` (with retries).
  - Seeds the database if `AUTO_SEED_ON_EMPTY_DB=true` and the User table is empty.
  - Starts the Next.js server (`npm run start` → `next start`).

### 6. Verify the deployment

```bash
# Check container status
docker compose ps

# View logs (follow)
docker compose logs -f app   # "app" is the service name from compose

# Or follow all services
docker compose logs -f
```

You should see output similar to:

```
app_1  | > next start
app_1  | ready - started server on http://0.0.0.0:3000
db_1   | LOG:  database system is ready to accept connections
```

Open a browser and navigate to `http://<host-ip>:3000`. You should see the login page.

**Default credentials (if seeding ran):**

| Role | Email | Password |
|------|-------|----------|
| Superuser | `superuser@example.com` | `super123` |
| Admin | `admin@example.com` | `admin123` |
| Driver | `driver@example.com` | `driver123` |

---

## Data Persistence

- **PostgreSQL data** is stored in a Docker volume named `postgres_data` (defined in `docker-compose.yml`). This volume persists across `docker compose down` and container recreations.
- To back up the volume, you can either:
  1. Dump the database using `pg_dump` inside the running container:
     ```bash
     docker exec $(docker compose ps -q db) pg_dump -U postgres driver_tracker > backup_$(date +%F).sql
     ```
  2. Or copy the volume’s underlying directory (if using the default local driver):
     ```bash
     # Find the mountpoint
     docker volume inspect driver_tracker_postgres_data
     # Then tar the shown path.
     ```

---

## Updating the Application

When you pull new code:

```bash
cd /opt/driver-tracker
git fetch origin
git checkout main   # or your target branch
git pull

# Rebuild and restart
docker compose pull        # pulls newer base images if any
docker compose build       # rebuilds the app image (uses Dockerfile)
docker compose up -d       # recreates containers with the new image
```

Compose will automatically re‑run the entrypoint, which applies any pending migrations.

---

## Health Checks & Monitoring (basic)

The `docker-compose.yml` already defines a simple healthcheck for the `db` service (`pg_isready`). For the app you can add a lightweight endpoint:

1. Add a route (if not present) e.g., `src/app/api/health/route.ts`:

   ```ts
   import { NextResponse } from 'next/server';

   export async function GET() {
     return NextResponse.json({ status: 'ok' });
   }
   ```

2. Then add a healthcheck to the `app` service in `docker-compose.yml`:

   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
     interval: 30s
     timeout: 5s
     retries: 3
   ```

You can then monitor with `docker compose ps` (shows `healthy`) or use a watchdog like `systemd` or external monitoring (Prometheus node exporter, cAdvisor, etc.).

If you want richer metrics, consider exposing Prometheus metrics from the Next.js app (e.g., using `prom-client`) and scraping them with a sidecar Prometheus instance—though for a simple local server this is optional.

---

## Backup & Disaster Recovery Procedure

1. **Stop the stack** (optional, ensures a consistent FS state):
   ```bash
   docker compose stop
   ```
2. **Backup the PostgreSQL volume** (method A – `pg_dump`):
   ```bash
   docker run --rm \
     --volumes-from driver_tracker_db_1 \
     -v $(pwd)/backups:/backup \
     postgres:15-alpine \
     pg_dump -h localhost -U postgres driver_tracker > /backup/db_$(date +%F_%H%M%S).sql
   ```
   Or use the volume dump method (see above).
3. **Backup the `.env` file** (contains secrets; store securely):
   ```bash
   cp .env /path/to/secure/backup/env_$(date +%F).bak
   ```
4. **To restore** on a fresh host:
   - Install Docker & Compose.
   - Clone the repo.
   - Copy back the `.env`.
   - (If using volume dump) stop Compose, replace the volume data, then start.
   - Or restore the dump into a fresh DB:
     ```bash
     docker compose up -d db   # start only db
     docker exec -i $(docker compose ps -q db) psql -U postgres -d driver_tracker < /path/to/backup.sql
     docker compose up -d      # then start the app
     ```

---

## Security Considerations

- **Do not expose the Docker daemon** to untrusted networks. Keep the host firewall (ufw/iptables) limiting access to port 3000 (or a reverse proxy) and SSH.
- **Use a reverse proxy** (nginx, Caddy, Traefik) in front of the container if you want TLS termination, HTTP basic auth, or to host multiple services on the same port. Example `nginx` snippet:
  ```nginx
  server {
      listen 443 ssl;
      server_name tracker.example.com;

      ssl_certificate /etc/letsencrypt/live/tracker.example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/tracker.example.com/privkey.pem;

      location / {
          proxy_pass http://localhost:3000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```
- **Keep the host OS patched** (`apt unattended-upgrades`).
- **Rotate secrets** periodically (`NEXTAUTH_SECRET`, `SETTINGS_ENCRYPTION_KEY`, provider credentials) and redeploy.
- **Limit Docker log size** to avoid disk fill: in `/etc/docker/daemon.json` add:
  ```json
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  ```
  Then `sudo systemctl restart docker`.

---

## TL;DR Quick Commands

```bash
# 1. Install Docker & Compose (see above)
# 2. Get code
mkdir -p /opt/driver-tracker && cd $_
git clone https://github.com/scarecrow87/driver_tracker.git .
# 3. Configure .env
cp .env.example .env
nano .env   # fill DATABASE_URL, secrets, etc.
# 4. Start
docker compose up -d
# 5. Verify
docker compose logs -f
# Open http://<host-ip>:3000
```

That’s it—you now have a fully functional, Docker‑only instance of Driver Tracker ready for testing, staging, or light production use. Adjust the `docker-compose.yml` (resources, restart policies) as your needs grow. Happy deploying!