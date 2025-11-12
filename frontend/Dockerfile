# Base stage with Node.js and Python
FROM node:24-alpine AS base
RUN apk add --no-cache python3 py3-pip
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Production build stage
FROM base AS prod-build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM node:24-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-build /app/.next/standalone ./
COPY --from=prod-build /app/.next/static ./.next/static
COPY --from=prod-build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

# Development image
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

# CI check image
FROM base AS ci
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["python3", "ci_check.py"]
