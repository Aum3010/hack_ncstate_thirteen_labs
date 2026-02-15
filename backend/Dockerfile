FROM python:3.11-slim

WORKDIR /app

# Added ffmpeg and libsndfile1 for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Entrypoint setup
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh 2>/dev/null || true && chmod +x /entrypoint.sh

ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=run:app
EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]