# nginx Frontend Server Setup

This is the nginx site block for the plain VPS frontend. It assumes:

- the Next.js standalone server is running on `127.0.0.1:3000`
- the backend is reachable over WireGuard at `http://<backend-wireguard-ip>:3001`
- the public frontend hostname is `https://<frontend-host>`

The browser stays on one origin, and nginx proxies `/api/*` to the backend privately.

## Site Block

Create `/etc/nginx/sites-available/driver-tracker-frontend`:

```nginx
server {
    listen 80;
    server_name <frontend-host>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <frontend-host>;

    ssl_certificate /etc/letsencrypt/live/<frontend-host>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<frontend-host>/privkey.pem;

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
        proxy_pass http://<backend-wireguard-ip>:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port 443;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
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

## Notes

- Use the backend WireGuard address in both the nginx proxy and `frontend/.env.production`.
- Keep `AUTH_COOKIE_SECURE=true` on the backend once the frontend hostname is HTTPS.
- The frontend service worker and manifest must stay on the public frontend origin for the PWA to work correctly.
