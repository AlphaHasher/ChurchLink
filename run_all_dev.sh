#!/bin/bash

# Function to cleanup processes on script exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
    echo "All services stopped."
    exit 0
}

# Set trap to cleanup on script exit (Ctrl+C or other signals)
trap cleanup SIGINT SIGTERM

# Start frontend development server
echo "Starting frontend development server..."
cd frontend/web/churchlink && npm run dev &
FRONTEND_PID=$!

# Start backend Python server
echo "Starting backend Python server..."
cd ../../../backend && uv run main.py &
BACKEND_PID=$!


echo ""
echo "All services started successfully!"
echo "Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"
echo "Backend: http://localhost:8000 (PID: $BACKEND_PID)"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for all background processes
wait $FRONTEND_PID $BACKEND_PID
