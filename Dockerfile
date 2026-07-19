FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
RUN npm ci && npm run clean && npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    TNL_MCP_HOST=0.0.0.0 \
    TNL_MCP_PORT=7317
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/sdk/package.json ./packages/sdk/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/research/package.json ./packages/research/package.json
COPY packages/adapters/package.json ./packages/adapters/package.json
COPY packages/connectors/package.json ./packages/connectors/package.json
COPY packages/mcp/package.json ./packages/mcp/package.json
COPY packages/artifacts/package.json ./packages/artifacts/package.json
COPY packages/gateway/package.json ./packages/gateway/package.json
COPY packages/onboarding/package.json ./packages/onboarding/package.json
COPY packages/cli/package.json ./packages/cli/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=build /app/packages/research/dist ./packages/research/dist
COPY --from=build /app/packages/research/public ./packages/research/public
COPY --from=build /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=build /app/packages/cli/dist ./packages/cli/dist

USER node
EXPOSE 7317
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:7317/healthz >/dev/null || exit 1
ENTRYPOINT ["node", "packages/mcp/dist/bin.js", "http"]
