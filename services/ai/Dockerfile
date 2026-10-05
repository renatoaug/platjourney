# The AI service, to run PlatJourney locally with `bun run docker:up`.
FROM python:3.14-slim
RUN pip install --no-cache-dir uv==0.11.10
WORKDIR /app/services/ai
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 UV_PYTHON_DOWNLOADS=never
COPY services/ai/pyproject.toml services/ai/uv.lock services/ai/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY services/ai/ ./
RUN uv sync --frozen --no-dev
EXPOSE 8100
CMD ["uv", "run", "--no-dev", "platjourney-ai"]
