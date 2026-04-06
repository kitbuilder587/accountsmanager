# Setup Guide

## Вариант 1: Docker (рекомендуется)

Всё ставится одной командой. Нужен только Docker и docker-compose.

```bash
# 1. Создать .env файл с ключами
cp .env.example .env
nano .env
# Заполнить:
#   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...    (от @BotFather)
#   OPENROUTER_API_KEY=sk-or-v1-xxx         (от openrouter.ai)

# 2. Запустить
docker compose up --build -d

# 3. Готово
# Админка:       http://localhost:3001
# PaddleOCR API: http://localhost:8866/health
```

Что ставится автоматически внутри контейнеров:
- **app**: Node.js 20, ffmpeg, yt-dlp, tesseract (eng+rus), шрифты Noto
- **paddleocr**: Python 3.11, PaddleOCR, FastAPI (модель ~84MB, скачается при первом запуске)

### Команды

```bash
docker compose up -d          # запустить
docker compose down            # остановить
docker compose logs -f app     # логи приложения
docker compose logs -f paddleocr  # логи OCR
docker compose up --build -d   # пересобрать после изменений
```

---

## Вариант 2: Локально без Docker

### Системные зависимости

**Ubuntu/Debian:**
```bash
# ffmpeg + ffprobe
sudo apt update
sudo apt install -y ffmpeg

# yt-dlp (скачивание рилсов)
sudo pip3 install yt-dlp
# или:
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Tesseract OCR (фоллбэк, если нет PaddleOCR)
sudo apt install -y tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng

# Кириллические шрифты для FFmpeg
sudo apt install -y fonts-noto
```

**macOS:**
```bash
brew install ffmpeg yt-dlp tesseract
# Русский языковой пакет для tesseract
brew install tesseract-lang
```

### Node.js зависимости

```bash
npm install
```

### PaddleOCR (точный OCR с координатами)

PaddleOCR даёт точные bbox для замены текста. Без него будет фоллбэк на Tesseract (текст найдёт, но без координат — замена текста на видео не сработает).

**Вариант A — Docker-контейнер отдельно:**
```bash
cd paddleocr-api
docker build -t paddleocr-api .
docker run -d -p 8866:8866 --name paddleocr paddleocr-api
# Проверить: curl http://localhost:8866/health
```

**Вариант B — Локально через pip (только linux/amd64):**
```bash
pip3 install paddlepaddle paddleocr fastapi uvicorn pillow
cd paddleocr-api
uvicorn server:app --host 0.0.0.0 --port 8866
```

> ARM64 (Apple Silicon M1/M2/M3): PaddlePaddle имеет баг с segfault.
> Используй Docker с `platform: linux/amd64` (через Rosetta).

### Сборка и запуск

```bash
# Собрать
npm run build

# Настроить переменные окружения
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."     # от @BotFather
export OPENROUTER_API_KEY="sk-or-v1-xxx"           # от openrouter.ai
export PADDLEOCR_URL="http://localhost:8866"        # если PaddleOCR запущен
export FONT_PATH="/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"  # путь к шрифту

# Запустить сервер
npm run start:server

# Или dev-режим (пересобирает при изменениях)
npm run dev:server
```

Админка будет на http://localhost:3001

---

## Быстрый тест с локальным видео

```bash
# Минимальный тест (нужен ffmpeg + PaddleOCR):
node scripts/test-local-video.mjs ./my-reel.mp4

# С кастомным текстом (нужен только ffmpeg):
node scripts/test-local-video.mjs ./my-reel.mp4 "Мой текст"
```

---

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Нет | Токен бота от @BotFather. Без него бот не запустится |
| `OPENROUTER_API_KEY` | Нет | Ключ API для генерации текста. Без него нужен custom text |
| `OPENROUTER_URL` | Нет | URL API (по умолчанию openrouter.ai). Можно указать свой |
| `LLM_MODEL` | Нет | Модель (по умолчанию `openai/gpt-4.1-mini`) |
| `PADDLEOCR_URL` | Нет | URL PaddleOCR API (по умолчанию `http://localhost:8866`) |
| `FONT_PATH` | Нет | Путь к TTF шрифту для drawtext |
| `PORT` | Нет | Порт сервера (по умолчанию `3001`) |
| `ACCOUNTS_MANAGER_APP_DATA_ROOT` | Нет | Папка данных (по умолчанию `.accountsmanager-dev/`) |

## Что для чего нужно

| Компонент | Зачем | Без него |
|---|---|---|
| **ffmpeg** | Извлечение кадров, рендеринг видео | Ничего не работает |
| **yt-dlp** | Скачивание рилсов по URL | Нельзя скачивать, но можно тестировать с локальным видео |
| **PaddleOCR** | Точные координаты текста (bbox) | Фоллбэк на Tesseract — текст найдёт, но без координат |
| **Tesseract** | Фоллбэк OCR | Без PaddleOCR и Tesseract — OCR не работает |
| **OpenRouter** | Перевод/генерация русского текста | Нужно указывать custom text вручную |
| **fonts-noto** | Кириллица в FFmpeg drawtext | Текст на видео будет квадратиками |
| **Telegram Bot** | Приём ссылок через Telegram | Ссылки можно добавлять через админку |
