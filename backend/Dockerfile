FROM ghcr.io/astral-sh/uv:debian-slim

# # don't need node js for python side
# RUN apt-get update && \
#     apt-get install -y curl gnupg && \
#     curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
#     apt-get install -y nodejs && \
#     apt-get clean && \
#     rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Python files first
COPY pyproject.toml uv.lock ./
COPY *.py ./
COPY routes/ ./routes/
COPY models/ ./models/
COPY helpers/ ./helpers/
COPY mongo/ ./mongo/
COPY firebase/ ./firebase/
COPY config/ ./config/
COPY .env* ./

EXPOSE 8000

# Verify files are present and run the application
CMD ["sh", "-c", "ls -la main.py && uv run main.py"]