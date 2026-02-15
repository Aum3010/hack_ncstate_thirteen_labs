FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN ffmpeg -version && ffprobe -version

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Entrypoint at /entrypoint.sh so it is not overwritten by volume mount ./backend:/app
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh 2>/dev/null || true && chmod +x /entrypoint.sh

ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=run:app
ENV FFMPEG_BINARY=/usr/bin/ffmpeg
ENV FFPROBE_BINARY=/usr/bin/ffprobe
EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
