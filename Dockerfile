FROM node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-rus \
    tesseract-ocr-eng \
    curl \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build frontend and backend
RUN npm run build

# Set data directory
ENV ACCOUNTS_MANAGER_APP_DATA_ROOT=/data
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run the web server (not Electron)
CMD ["node", "dist/src/server.js"]
