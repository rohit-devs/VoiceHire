FROM python:3.11-slim
WORKDIR /app
COPY apps/api/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .
COPY apps/api/app ./app
COPY packages/prompts ./packages/prompts
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
