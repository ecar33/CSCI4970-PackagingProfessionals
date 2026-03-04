# Import base image of python3
FROM python:3.12-slim
# Set working directory
WORKDIR /app
# Install Tesseract OCR and Poppler (for pdf2image)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils && \
    rm -rf /var/lib/apt/lists/*
# Set environment variable
ENV FLASK_APP=app.py
# Copy all files to container
COPY . .
# Run installations from requirements.txt
RUN pip install -r requirements.txt
# Expose port 5000
EXPOSE 5000
# Run the app
CMD ["python", "app.py"]
