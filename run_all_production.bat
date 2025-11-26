@echo off

start cmd /k "title frontend && cd /d frontend\web\churchlink && npm run build && npm run preview"

start cmd /k "title backend && cd /d backend && uv run main.py production"

echo All services started.
exit
