# Nginx Configuration for Frontend Server

This configuration serves the Driver Tracker frontend and proxies API calls to the backend.

## Prerequisites

- Nginx installed
- SSL certificate (handled by Cloudflare, so nginx can use HTTP)

## Configuration

Create `/etc/nginx/sites-available/driver-tracker-frontend`:

```nginx
server {
    listen 80;
    server_name pelz-dt.shellshock.net.au;

    root /var/www/driver-tracker-frontend/.next/standalone;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve Next.js static files
    location /_next/static/ {
        alias /var/www/driver-tracker-frontend/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Serve public assets
    location /icons/ {
        alias /var/www/driver-tracker-frontend/public/icons/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /manifest.json {
        alias /var/www/driver-tracker-frontend/public/manifest.json;
    }

    # Main application
    location / {
        try_files $uri $uri/ /index.html;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Proxy API calls to backend (Traefik)
    location /api/ {
        proxy_pass https://api.pelz-dt.shellshock.net.au/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Proxy auth requests
    location /api/auth/ {
        proxy_pass https://api.pelz-dt.shellshock.net.au/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Deployment Steps

1. **Copy configuration**

```bash
sudo cp nginx-frontend-config.conf /etc/nginx/sites-available/driver-tracker-frontend
sudo ln -s /etc/nginx/sites-available/driver-tracker-frontend /etc/nginx/sites-enabled/
```

2. **Test configuration**

```bash
sudo nginx -t
```

3. **Reload nginx**

```bash
sudo systemctl reload nginx
```

4. **Deploy frontend**

```bash
# Copy standalone output
scp -r .next/standalone/* user@frontend-server:/var/www/driver-tracker-frontend/
scp -r .next/static user@frontend-server:/var/www/driver-tracker-frontend/.next/
scp -r public/* user@frontend-server:/var/www/driver-tracker-frontend/public/
```

5. **Start frontend service**

Create systemd service at `/etc/systemd/system/driver-tracker-frontend.service`:

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
Environment=NEXTAUTH_URL=https://api.pelz-dt.shellshock.net.au
Environment=NEXTAUTH_SECRET=<your-secret>
Environment=NEXT_PUBLIC_API_URL=https://api.pelz-dt.shellshock.net.au/api

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable driver-tracker-frontend
sudo systemctl start driver-tracker-frontend
```

## Cloudflare Setup

1. Add DNS record for `pelz-dt.shellshock.net.au` → frontend server IP (proxied)
2. Add DNS record for `api.pelz-dt.shellshock.net.au` → backend server IP (proxied)
3. Set SSL/TLS mode to "Full" or "Full (Strict)"

## Backend CORS Configuration

The backend must allow CORS from the frontend domain. Add to backend `.env`:

```bash
CORS_ORIGIN=https://pelz-dt.shellshock.net.au
```

## Testing

```bash
# Check nginx is running
curl -I http://localhost

# Check frontend loads
curl -I https://pelz-dt.shellshock.net.au

# Check API proxy works
curl -I https://pelz-dt.shellshock.net.au/api/health
```

## Troubleshooting

- **502 Bad Gateway**: Check frontend service is running (`systemctl status driver-tracker-frontend`)
- **API calls fail**: Verify backend URL is correct and accessible
- **Session issues**: Ensure `NEXTAUTH_SECRET` matches on both servers