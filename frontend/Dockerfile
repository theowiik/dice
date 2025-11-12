# Base stage with Node.js, Python, and pnpm
FROM node:24-alpine AS base
RUN apk add --no-cache python3 py3-pip \
    && npm install -g pnpm@10.22.0
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Production build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production image (static assets served by nginx)
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Development image
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
ENV NODE_ENV=development
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

# CI check image
FROM base AS ci
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["python3", "ci_check.py"]
