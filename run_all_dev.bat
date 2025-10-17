@echo off

start cmd /k "cd /d frontend\web\churchlink && npm run dev"
start cmd /k "cd /d backend && uv run main.py"

echo All services started.
exit
