# Build with the extracted bundle as context; provide qualified base-image digests.
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE} AS build
WORKDIR /build
COPY requirements-employee.txt ./requirements.txt
COPY wheels/ ./wheels/
RUN python -m venv /opt/reference/employee/.venv \
    && /opt/reference/employee/.venv/bin/pip install --no-cache-dir --require-hashes -r requirements.txt \
    && /opt/reference/employee/.venv/bin/pip install --no-cache-dir --no-deps wheels/*.whl \
    && /opt/reference/employee/.venv/bin/pip check

FROM ${PYTHON_IMAGE} AS runtime
COPY --from=build /opt/reference/employee/.venv /opt/reference/employee/.venv
ENV PATH="/opt/reference/employee/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/reference
USER 10001:10001
CMD ["python", "-I", "-c", "from app.agent import geowiz_backend_status; print(geowiz_backend_status())"]
