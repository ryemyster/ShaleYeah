# Build from the independent extraction bundle with qualified image digests.
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE} AS build
WORKDIR /build
COPY requirements-employee.txt ./requirements.txt
COPY wheels/ ./wheels/
RUN python -m venv /opt/curve-smith/employee/.venv \
    && /opt/curve-smith/employee/.venv/bin/pip install --no-cache-dir --require-hashes -r requirements.txt \
    && /opt/curve-smith/employee/.venv/bin/pip install --no-cache-dir --no-deps wheels/*.whl \
    && /opt/curve-smith/employee/.venv/bin/pip check

FROM ${PYTHON_IMAGE} AS runtime
COPY --from=build /opt/curve-smith/employee/.venv /opt/curve-smith/employee/.venv
ENV PATH="/opt/curve-smith/employee/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/curve-smith
USER 10001:10001
CMD ["python", "-I", "-c", "from app.agent import reservoir_engineer_backend_status; print(reservoir_engineer_backend_status())"]
