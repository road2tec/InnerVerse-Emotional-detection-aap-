#!/bin/bash
# Setup script for Emotion Based Activity Recommendation System - Backend

echo "🚀 Setting up Python backend..."

PROJECT_DIR="$(dirname "$0")"
cd "$PROJECT_DIR/backend"

# Create virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "To start the backend server:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python app.py"
echo ""
echo "The API will be available at: http://localhost:8000"
echo "API Docs (Swagger): http://localhost:8000/docs"
echo ""
echo "📌 Make sure MongoDB is running locally on port 27017"
