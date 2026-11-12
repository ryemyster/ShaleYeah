# Build from the independent extraction bundle with qualified image digests.
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE} AS build
WORKDIR /build
COPY requirements-employee.txt ./requirements.txt
COPY wheels/ ./wheels/
RUN python -m venv /opt/risk-analysis/employee/.venv \
    && /opt/risk-analysis/employee/.venv/bin/pip install --no-cache-dir --require-hashes -r requirements.txt \
    && /opt/risk-analysis/employee/.venv/bin/pip install --no-cache-dir --no-deps wheels/*.whl \
    && /opt/risk-analysis/employee/.venv/bin/pip check

FROM ${PYTHON_IMAGE} AS runtime
COPY --from=build /opt/risk-analysis/employee/.venv /opt/risk-analysis/employee/.venv
ENV PATH="/opt/risk-analysis/employee/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/risk-analysis
USER 10001:10001
CMD ["python", "-I", "-c", "from app.agent import risk_analyst_backend_status; print(risk_analyst_backend_status())"]
