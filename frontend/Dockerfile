# Stage 1 – Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm ci

# Copy the rest of the frontend source
COPY . .

# Build Next.js app (generates .next/standalone/)
RUN npm run build

# Stage 2 – Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx

# Copy standalone output from builder
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static/ ./.next/static/
COPY --from=builder /app/public/ ./public/

# Copy nginx config and entrypoint script
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
