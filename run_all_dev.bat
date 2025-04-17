@echo off

start cmd /k "cd /d frontend\web\churchlink && npm run dev"
start cmd /k "cd /d backend && uv run python -m uvicorn --host 127.0.0.1 --port 8000 --reload main:app"
start cmd /k "cd /d backend\strapi\churchlink && npm run dev"

echo All services started.
exit
