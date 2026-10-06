# ─── Build stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install all workspace deps with the lockfile for reproducible builds.
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# Build API and web.
COPY . .
RUN npm run build

# Prune to production deps for the runtime image.
RUN npm prune --omit=dev

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# npm workspaces hoist dependencies to the root node_modules, so that's all the
# runtime needs (Node resolves up to it from apps/api/dist).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY locales ./locales
COPY themes ./themes

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
