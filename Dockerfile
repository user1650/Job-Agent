FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for browser-use / playwright
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install playwright browsers
RUN playwright install --with-deps chromium

# Copy the rest of the application
COPY . .

# Create directories for persistent data
RUN mkdir -p data static/resumes

EXPOSE 8000

CMD ["python", "api.py"]
