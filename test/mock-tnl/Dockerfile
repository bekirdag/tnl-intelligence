FROM node:22-alpine

WORKDIR /mock
COPY test/mock-tnl/server.mjs ./test/mock-tnl/server.mjs
COPY test/fixtures/api ./test/fixtures/api

USER node
EXPOSE 8080
HEALTHCHECK --interval=2s --timeout=1s --start-period=1s --retries=20 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["node", "test/mock-tnl/server.mjs", "--host", "0.0.0.0", "--port", "8080"]
