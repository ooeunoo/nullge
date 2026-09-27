FROM node:22-bookworm-slim
WORKDIR /app
COPY index.html styles.css robots.txt sitemap.xml .nojekyll ./public/
COPY assets ./public/assets/
COPY apps/site/server.mjs ./server.mjs
ENV NODE_ENV=production
CMD ["node", "server.mjs"]
