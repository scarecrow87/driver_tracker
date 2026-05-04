# Nginx Frontend Server Setup

Use this when the frontend runs on a separate host but should expose one public HTTPS origin for the PWA and API.

## Target Architecture

- Public app URL: `https://driver-tracker.example.com`
- Frontend server: Next.js standalone on `127.0.0.1:3000`
- Backend API: reachable from nginx at `http://<backend-host>:3001`
- Browser sees one origin: nginx serves the frontend and proxies `/api/*` to the backend

This keeps the backend-issued HTTP-only auth cookie same-origin and avoids CORS for normal app traffic.

## Build Environment

Create `frontend/.env.production` before building:

```bash
NEXT_PUBLIC_API_URL=https://driver-tracker.example.com/api
INTERNAL_API_URL=http://<backend-host>:3001/api
```

Build locally or on the frontend server:

```bash
cd frontend
npm ci
npm run build
```

Copy the standalone output:

```bash
sudo mkdir -p /var/www/driver-tracker-frontend/.next
sudo rsync -a .next/standalone/ /var/www/driver-tracker-frontend/
sudo rsync -a .next/static/ /var/www/driver-tracker-frontend/.next/static/
sudo rsync -a public/ /var/www/driver-tracker-frontend/public/
```

## Systemd Service

Create `/etc/systemd/system/driver-tracker-frontend.service`:

```ini
[Unit]
Description=Driver Tracker Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/driver-tracker-frontend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=https://driver-tracker.example.com/api
Environment=INTERNAL_API_URL=http://<backend-host>:3001/api

[Install]
WantedBy=multi-user.target
```

Start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now driver-tracker-frontend
```

## Nginx Site

Create `/etc/nginx/sites-available/driver-tracker-frontend`:

```nginx
server {
    listen 80;
    server_name driver-tracker.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name driver-tracker.example.com;

    ssl_certificate /etc/letsencrypt/live/driver-tracker.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/driver-tracker.example.com/privkey.pem;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json application/manifest+json;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /_next/static/ {
        alias /var/www/driver-tracker-frontend/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /icons/ {
        alias /var/www/driver-tracker-frontend/public/icons/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /manifest.json {
        alias /var/www/driver-tracker-frontend/public/manifest.json;
        add_header Cache-Control "no-cache";
    }

    location ~ ^/(sw\.js|workbox-[^/]+\.js|worker-[^/]+\.js)$ {
        alias /var/www/driver-tracker-frontend/public/$1;
        add_header Cache-Control "no-cache";
    }

    location /api/ {
        proxy_pass http://<backend-host>:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/driver-tracker-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Backend Environment

Set these on the backend service:

```bash
NEXTAUTH_SECRET=<shared-jwt-secret>
AUTH_COOKIE_SECURE=true
CORS_ORIGIN=https://driver-tracker.example.com
VAPID_PUBLIC_KEY=<web-push-public-key>
VAPID_PRIVATE_KEY=<web-push-private-key>
VAPID_SUBJECT=mailto:admin@example.com
```

Generate VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

## Verification

```bash
curl -I https://driver-tracker.example.com
curl -I https://driver-tracker.example.com/manifest.json
curl -I https://driver-tracker.example.com/sw.js
curl -i -X POST https://driver-tracker.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"driver@example.com","password":"driver123"}'
```

The login response should include `Set-Cookie: driver_tracker_session=...`.
