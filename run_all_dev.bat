@echo off

start cmd /k "cd /d frontend\web\churchlink && npm run dev"
start cmd /k "cd /d backend && uv run main.py debug"

echo All services started.
exit
