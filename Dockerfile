# Production image — run: docker build -t resume-matcher . && docker run -p 8080:8080 -e PORT=8080 resume-matcher
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY matcher.py app.py ./
COPY templates ./templates

# Non-root user
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD gunicorn --bind 0.0.0.0:${PORT} --workers 2 --threads 2 --timeout 60 app:app
