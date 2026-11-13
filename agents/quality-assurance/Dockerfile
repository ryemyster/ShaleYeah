# Build with the extracted bundle as context; provide qualified base-image digests.
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE} AS build
WORKDIR /build
COPY requirements-employee.txt ./requirements.txt
COPY wheels/ ./wheels/
RUN python -m venv /opt/qa/employee/.venv \
    && /opt/qa/employee/.venv/bin/pip install --no-cache-dir --require-hashes -r requirements.txt \
    && /opt/qa/employee/.venv/bin/pip install --no-cache-dir --no-deps wheels/*.whl \
    && /opt/qa/employee/.venv/bin/pip check

FROM ${PYTHON_IMAGE} AS runtime
COPY --from=build /opt/qa/employee/.venv /opt/qa/employee/.venv
ENV PATH="/opt/qa/employee/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1
WORKDIR /opt/qa
USER 10001:10001
CMD ["python", "-I", "-c", "from app.agent import qa_backend_status; print(qa_backend_status())"]
