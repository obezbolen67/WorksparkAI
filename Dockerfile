# --- Builder ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# .env.production must be present in the build context (created by Cloud Build) before this step
# Verify env file was created
RUN echo "=== Contents of .env.production ===" && cat .env.production || echo "WARNING: .env.production not found"
RUN npm run build
# Verify build output
RUN echo "=== Build completed, checking dist ===" && ls -la dist/

# --- Runner ---
FROM nginx:alpine
# Replace default server config to support SPA routing and Cloud Run port
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
