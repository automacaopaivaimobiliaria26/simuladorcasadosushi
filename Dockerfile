# syntax=docker/dockerfile:1
# Build em Node; imagem oficial multiarquitetura é adequada à VPS Ubuntu ARM64.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV CI=1
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm check && pnpm test -- --reporter=dot && pnpm build:static

# Runtime somente estático; não expõe portas do host nem depende do servidor Node.
FROM nginx:alpine AS runtime
COPY deploy/vps/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/public/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
