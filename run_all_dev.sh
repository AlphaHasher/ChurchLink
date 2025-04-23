#!/bin/bash

# Start frontend service
cd frontend/web/churchlink && npm run dev &
FRONTEND_PID=$!

# Start backend service
cd backend && uv run python -m uvicorn --host 127.0.0.1 --port 8000 --reload main:app &
BACKEND_PID=$!

# Start Strapi service
cd backend/strapi/churchlink && npm run dev &
STRAPI_PID=$!

echo "All services started."
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "kill $FRONTEND_PID $BACKEND_PID $STRAPI_PID; exit" INT
wait 