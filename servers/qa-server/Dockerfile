# Build from the independently extracted archive bundle, with its production lock.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS install
WORKDIR /opt/qa/tool
COPY npm/ /opt/qa/npm/
COPY tool/package.json tool/package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund

FROM ${NODE_IMAGE} AS runtime
WORKDIR /opt/qa/tool
COPY --from=install /opt/qa/tool/node_modules ./node_modules
USER 10001:10001
CMD ["node", "node_modules/@shaleyeah/server-qa/dist/index.js"]
