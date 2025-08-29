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

# testing
COPY . .

EXPOSE 8000

# what the heck is happening
CMD ["sh", "-c", "echo '=== Files in /app ===' && ls -la /app && echo '=== Running main.py ===' && uv run main.py"]