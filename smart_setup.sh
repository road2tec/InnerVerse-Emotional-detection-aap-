#!/bin/bash

# 🚀 Smart Setup Script for Emotion Detection App
# Automatically detects network configuration and sets up the project

echo "🎭 Emotion Detection App - Smart Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to detect machine IP
detect_ip() {
    local ip=""

    # Try different methods to get IP
    if command -v ifconfig > /dev/null 2>&1; then
        # Mac/Linux with ifconfig
        ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | sed 's/addr://')
    elif command -v ip > /dev/null 2>&1; then
        # Linux with ip command
        ip=$(ip route get 8.8.8.8 | grep -oP 'src \K\S+' 2>/dev/null)
    elif command -v hostname > /dev/null 2>&1; then
        # Try hostname method
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    # Validation
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "$ip"
    else
        echo "192.168.1.7" # fallback
    fi
}

# Function to test backend connection
test_backend() {
    local url="$1"
    local test_url="${url%/api}/docs"

    if curl -s --connect-timeout 3 --max-time 5 "$test_url" > /dev/null 2>&1; then
        return 0  # Success
    else
        return 1  # Failure
    fi
}

# Main setup
echo "🔍 Detecting your network configuration..."

# Get machine IP
MACHINE_IP=$(detect_ip)
print_info "Detected IP address: $MACHINE_IP"

# Check if backend is running
print_info "Testing backend connectivity..."

# Test different URLs
BACKEND_URLS=(
    "http://$MACHINE_IP:8000"
    "http://127.0.0.1:8000"
    "http://localhost:8000"
)

WORKING_URL=""
for url in "${BACKEND_URLS[@]}"; do
    print_info "Testing: $url"
    if test_backend "$url"; then
        WORKING_URL="$url"
        print_status "Backend found at: $url"
        break
    fi
done

if [ -z "$WORKING_URL" ]; then
    print_warning "Backend not detected. Please start it manually:"
    echo "   cd backend && python app.py"
    echo ""
    WORKING_URL="http://$MACHINE_IP:8000"  # Use network IP as default
fi

# Configuration options
echo ""
echo "📱 Device Configuration Options:"
echo "1. 📱 Physical Device (Recommended) - $MACHINE_IP"
echo "2. 🤖 Android Emulator - 10.0.2.2"
echo "3. 📲 iOS Simulator - 127.0.0.1"
echo "4. 🔧 Custom URL - Enter manually"
echo "5. 🚀 Auto-detect (Use detected working URL)"
echo ""

if [ -n "$WORKING_URL" ]; then
    echo -e "${GREEN}✨ Auto-detected working backend: $WORKING_URL${NC}"
    echo ""
    read -p "👉 Press Enter to use auto-detected, or choose 1-4: " choice
    choice=${choice:-5}  # Default to 5 (auto-detect) if Enter pressed
else
    read -p "👉 Choose option (1-4): " choice
fi

# Set API URL based on choice
case $choice in
    1)
        API_URL="http://$MACHINE_IP:8000/api"
        SETUP_TYPE="Physical Device"
        ;;
    2)
        API_URL="http://10.0.2.2:8000/api"
        SETUP_TYPE="Android Emulator"
        ;;
    3)
        API_URL="http://127.0.0.1:8000/api"
        SETUP_TYPE="iOS Simulator"
        ;;
    4)
        read -p "🔗 Enter custom backend URL (with port): " CUSTOM_URL
        API_URL="$CUSTOM_URL/api"
        SETUP_TYPE="Custom"
        ;;
    5|"")
        API_URL="$WORKING_URL/api"
        SETUP_TYPE="Auto-detected"
        ;;
    *)
        print_error "Invalid option, using network IP"
        API_URL="http://$MACHINE_IP:8000/api"
        SETUP_TYPE="Default (Network IP)"
        ;;
esac

# Create .env file
echo ""
print_info "Creating configuration..."

# Navigate to frontend_expo directory
cd frontend_expo 2>/dev/null || {
    print_error "frontend_expo directory not found. Make sure you're in the project root."
    exit 1
}

# Create .env file
cat > .env << EOF
# 🚀 Auto-generated configuration
# Generated: $(date)
# Setup type: $SETUP_TYPE
# Detected IP: $MACHINE_IP

EXPO_PUBLIC_API_BASE_URL=$API_URL

# Alternative configurations (uncomment to use):
# EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
# EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api
# EXPO_PUBLIC_API_BASE_URL=http://$MACHINE_IP:8000/api

# Network troubleshooting info:
# Machine IP: $MACHINE_IP
# Working backend: ${WORKING_URL:-"Not detected"}
EOF

print_status "Configuration saved to frontend_expo/.env"
print_status "API URL: $API_URL"

# Test the configuration
echo ""
print_info "Testing final configuration..."
if test_backend "${API_URL%/api}"; then
    print_status "Configuration test passed!"
else
    print_warning "Configuration test failed. Backend might not be running."
fi

# Final instructions
echo ""
echo "🚀 Setup Complete! Next steps:"
echo ""
echo "1. Start Backend (if not running):"
echo "   cd ../backend && python app.py"
echo ""
echo "2. Start Frontend:"
echo "   npx expo start --clear"
echo ""
echo "3. Connect Device:"
echo "   📱 Physical Device: Scan QR with Expo Go"
echo "   🤖 Emulator: Press 'a' for Android, 'i' for iOS"
echo ""
echo "🔧 If connection fails:"
echo "   • Run this script again: ./setup.sh"
echo "   • Check network connection"
echo "   • Verify backend is running"
echo ""
print_status "You're all set! 🎉"