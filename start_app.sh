#!/bin/bash

# 🚀 Emotion App - Automatic Startup Script
# This script fixes common errors and starts the complete system

echo "🎭 Starting Emotion Based Activity Recommendation System"
echo "======================================================"

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "README.md" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend_expo" ]]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_step "1. Checking system requirements..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js first."
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_status "Python found: $PYTHON_VERSION"
else
    print_error "Python3 not found. Please install Python3 first."
    exit 1
fi

# Check MongoDB
print_step "2. Starting MongoDB..."
if brew services list | grep -q "mongodb.*started"; then
    print_status "MongoDB is already running"
else
    print_warning "Starting MongoDB service..."
    brew services start mongodb/brew/mongodb-community@5.0
    sleep 3
fi

# Test MongoDB connection
if mongosh --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    print_status "MongoDB connection successful"
else
    print_error "Cannot connect to MongoDB. Please check your installation."
    exit 1
fi

print_step "3. Setting up backend..."

# Kill any existing processes on port 8000
if lsof -ti:8000 > /dev/null; then
    print_warning "Port 8000 is in use. Stopping existing processes..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Navigate to backend
cd backend

# Check if virtual environment exists
if [[ ! -d "venv" ]]; then
    print_warning "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade requirements
print_status "Installing Python dependencies..."
pip install -r requirements.txt --quiet

# Check if .env file has required variables
if [[ ! -f ".env" ]]; then
    print_error "Backend .env file not found!"
    exit 1
fi

# Validate environment variables
if ! grep -q "OPENAI_API_KEY" .env; then
    print_warning "OpenAI API key not found in .env file"
fi

# Start backend in background
print_status "Starting FastAPI backend server..."
nohup python app.py > ../backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo -n "Waiting for backend to start"
for i in {1..15}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo ""
        print_status "Backend server started successfully (PID: $BACKEND_PID)"
        break
    fi
    echo -n "."
    sleep 1
done

# Test backend
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    print_error "Backend failed to start. Check backend.log for errors."
    exit 1
fi

# Return to project root
cd ..

print_step "4. Setting up frontend..."

# Kill any existing processes on port 8081
if lsof -ti:8081 > /dev/null; then
    print_warning "Port 8081 is in use. Stopping existing processes..."
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Navigate to frontend
cd frontend_expo

# Check if .env file exists
if [[ ! -f ".env" ]]; then
    print_warning "Creating frontend .env file..."

    # Get local IP address
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

    cat > .env << EOF
# 🔗 Mobile App API Configuration
EXPO_PUBLIC_API_BASE_URL=http://$LOCAL_IP:8000/api

# 📱 Development Settings
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_DEBUG=true
EOF

    print_status "Created .env file with IP: $LOCAL_IP"
fi

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    print_status "Installing JavaScript dependencies..."
    npm install --silent
fi

# Start Expo in background
print_status "Starting Expo development server..."
nohup npx expo start --clear > ../expo.log 2>&1 &
EXPO_PID=$!

# Wait for Expo to start
echo -n "Waiting for Expo to start"
for i in {1..20}; do
    if curl -s http://localhost:8081 > /dev/null 2>&1; then
        echo ""
        print_status "Expo server started successfully (PID: $EXPO_PID)"
        break
    fi
    echo -n "."
    sleep 1
done

# Return to project root
cd ..

print_step "5. Final system check..."

# Test all endpoints
BACKEND_STATUS=$(curl -s http://localhost:8000/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
AI_STATUS=$(curl -s http://localhost:8000/api/recommendations/status | grep -o '"ai_recommendations":[^,]*' | cut -d':' -f2)

if [[ "$BACKEND_STATUS" == "healthy" ]]; then
    print_status "✅ Backend API: Healthy"
else
    print_error "❌ Backend API: Not responding"
fi

if [[ "$AI_STATUS" == "true" ]]; then
    print_status "✅ AI Recommendations: Available"
else
    print_warning "⚠️ AI Recommendations: Fallback mode"
fi

if lsof -ti:8081 > /dev/null; then
    print_status "✅ Expo Dev Server: Running"
else
    print_error "❌ Expo Dev Server: Not running"
fi

# Get local IP for mobile connection
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

echo ""
echo "🎉 System Started Successfully!"
echo "================================="
echo ""
echo "📱 To connect via Expo Go:"
echo "   1. Install Expo Go app on your phone"
echo "   2. Scan QR code or enter: exp://$LOCAL_IP:8081"
echo ""
echo "🌐 Backend URLs:"
echo "   • API: http://localhost:8000"
echo "   • Docs: http://localhost:8000/docs"
echo ""
echo "🔍 Logs:"
echo "   • Backend: tail -f backend.log"
echo "   • Expo: tail -f expo.log"
echo ""
echo "🛑 To stop services:"
echo "   • kill $BACKEND_PID $EXPO_PID"
echo "   • Or: pkill -f 'python app.py' && pkill -f 'expo start'"
echo ""

# Save PIDs for easy stopping
echo "BACKEND_PID=$BACKEND_PID" > .pids
echo "EXPO_PID=$EXPO_PID" >> .pids

print_status "PIDs saved to .pids file"
print_status "System ready for development!"

echo "📊 Quick Test:"
echo "curl http://localhost:8000/api/recommendations/status"