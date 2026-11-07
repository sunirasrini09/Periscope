FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ocr.txt .

RUN pip install --no-cache-dir -r requirements-ocr.txt

COPY ocr_service.py .

ENV TESSERACT_CMD=/usr/bin/tesseract
ENV OCR_LANG=eng

CMD ["sh", "-c", "uvicorn ocr_service:app --host 0.0.0.0 --port ${PORT:-10000}"]