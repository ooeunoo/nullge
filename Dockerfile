FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production
CMD ["node", "scripts/start.mjs"]
