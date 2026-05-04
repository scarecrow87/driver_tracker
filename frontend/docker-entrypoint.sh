#!/bin/sh
# Start nginx in background (foreground mode)
nginx -c /etc/nginx/nginx.conf -g 'daemon off;' &

# Unset HOSTNAME so Next.js listens on 0.0.0.0
unset HOSTNAME

# Start the Next.js server
exec node server.js
