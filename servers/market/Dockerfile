# Build from the extraction bundle; the verifier has no employee implementation.
ARG NODE_IMAGE=node:22-bookworm-slim
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${NODE_IMAGE} AS node
RUN mkdir /node-libs && cp -L /usr/lib/*-linux-gnu/libstdc++.so.6 /node-libs/
WORKDIR /opt/market/tool
COPY npm/ /opt/market/npm/
COPY tool/package.json tool/package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund

FROM ${PYTHON_IMAGE} AS verifier
WORKDIR /build
COPY requirements-tool.txt ./requirements.txt
COPY wheels/ ./wheels/
RUN python -m venv /opt/market/tool/.venv \
    && /opt/market/tool/.venv/bin/pip install --no-cache-dir --require-hashes -r requirements.txt \
    && /opt/market/tool/.venv/bin/pip install --no-cache-dir --no-deps wheels/shaleyeah_contracts-*.whl wheels/shaleyeah_evaluations-*.whl \
    && /opt/market/tool/.venv/bin/pip check

FROM ${PYTHON_IMAGE} AS runtime
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /node-libs/ /usr/local/lib/
RUN ldconfig
COPY --from=node /opt/market/tool/node_modules /opt/market/tool/node_modules
COPY --from=verifier /opt/market/tool/.venv /opt/market/tool/.venv
ENV PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/market/tool
USER 10001:10001
CMD ["node", "node_modules/@shaleyeah/server-market/examples/local-http.mjs"]
