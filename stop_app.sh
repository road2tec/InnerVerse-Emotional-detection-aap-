#!/bin/bash

# 🛑 Emotion App - Stop Script
# Safely stops all services and cleans up processes

echo "🛑 Stopping Emotion Based Activity Recommendation System"
echo "========================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to kill process by PID
kill_process() {
    local pid=$1
    local name=$2

    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        print_status "Stopping $name (PID: $pid)..."
        kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
        sleep 1

        if kill -0 "$pid" 2>/dev/null; then
            print_warning "$name process still running, force killing..."
            kill -9 "$pid" 2>/dev/null
        else
            print_status "$name stopped successfully"
        fi
    else
        print_warning "$name process not found or already stopped"
    fi
}

# Stop services using saved PIDs
if [[ -f ".pids" ]]; then
    print_status "Reading saved process IDs..."
    source .pids

    kill_process "$BACKEND_PID" "Backend Server"
    kill_process "$EXPO_PID" "Expo Dev Server"

    # Clean up PID file
    rm -f .pids
else
    print_warning "No .pids file found, searching for processes..."
fi

# Kill any remaining processes by port
print_status "Checking for processes on ports 8000 and 8081..."

# Port 8000 (Backend)
if lsof -ti:8000 > /dev/null 2>&1; then
    print_warning "Killing remaining processes on port 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
fi

# Port 8081 (Expo)
if lsof -ti:8081 > /dev/null 2>&1; then
    print_warning "Killing remaining processes on port 8081..."
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
fi

# Kill processes by name pattern
print_status "Cleaning up any remaining Python/Node processes..."

# Kill FastAPI processes
pkill -f "python app.py" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true

# Kill Expo processes
pkill -f "expo start" 2>/dev/null || true
pkill -f "Metro" 2>/dev/null || true

# Wait a moment for cleanup
sleep 2

# Verify ports are free
port_8000_free=true
port_8081_free=true

if lsof -ti:8000 > /dev/null 2>&1; then
    print_error "Port 8000 is still in use!"
    port_8000_free=false
fi

if lsof -ti:8081 > /dev/null 2>&1; then
    print_error "Port 8081 is still in use!"
    port_8081_free=false
fi

# Clean up log files (optional)
read -p "🗑️ Delete log files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f backend.log expo.log error.log
    print_status "Log files cleaned up"
fi

echo ""
if $port_8000_free && $port_8081_free; then
    echo "✅ All services stopped successfully!"
    echo "🔌 Ports 8000 and 8081 are now free"
else
    echo "⚠️ Some processes may still be running"
    echo "🔍 Check with: lsof -ti:8000,8081"
fi

echo ""
echo "🚀 To restart the system:"
echo "   ./start_app.sh"
echo ""