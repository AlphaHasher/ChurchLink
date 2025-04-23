@echo off

start cmd /k "cd /d frontend\web\churchlink && npm run dev"
start cmd /k "cd /d backend && uv run main.py"
start cmd /k "cd /d backend\strapi\churchlink && npm run dev"

echo All services started.
exit
