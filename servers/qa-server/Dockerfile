# Installed tool and portable verifier only; no agent, source workspace or operator data.
ARG NODE_IMAGE=node:22-bookworm-slim
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${NODE_IMAGE} AS node
RUN mkdir /node-libs && cp -L /usr/lib/*-linux-gnu/libstdc++.so.6 /node-libs/
WORKDIR /opt/qa/tool
COPY npm/ /opt/qa/npm/
COPY tool/package.json tool/package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-audit --no-fund

FROM ${PYTHON_IMAGE} AS verifier
WORKDIR /build
COPY requirements-tool.txt ./requirements.txt
COPY wheels/ ./wheels/
RUN python -m venv /opt/qa/tool/.venv \
    && /opt/qa/tool/.venv/bin/pip install --no-cache-dir --require-hashes -r requirements.txt \
    && /opt/qa/tool/.venv/bin/pip install --no-cache-dir --no-deps wheels/shaleyeah_contracts-*.whl wheels/shaleyeah_evaluations-*.whl \
    && /opt/qa/tool/.venv/bin/pip check

FROM ${PYTHON_IMAGE} AS runtime
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /node-libs/ /usr/local/lib/
RUN ldconfig
COPY --from=node /opt/qa/tool/node_modules /opt/qa/tool/node_modules
COPY --from=verifier /opt/qa/tool/.venv /opt/qa/tool/.venv
ENV PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/qa/tool
USER 10001:10001
CMD ["node", "node_modules/@shaleyeah/server-qa/examples/local-http.mjs"]
