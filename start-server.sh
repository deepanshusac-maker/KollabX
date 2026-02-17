#!/bin/bash

# Simple HTTP server to access KollabX on mobile
# This will start a server on port 8000

echo "🚀 Starting KollabX development server..."
echo ""
echo "To access on mobile:"
echo "1. Make sure your phone is on the same WiFi network"
echo "2. Find your computer's IP address (see instructions below)"
echo "3. Open: http://YOUR_IP:8000"
echo ""
echo "Finding your IP address..."
echo ""

# Try to get IP address
if command -v ipconfig &> /dev/null; then
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
elif command -v hostname &> /dev/null; then
    IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
else
    IP="localhost"
fi

if [ "$IP" != "localhost" ] && [ "$IP" != "" ]; then
    echo "📍 Your IP address appears to be: $IP"
    echo "📱 Mobile URL: http://$IP:8000"
else
    echo "⚠️  Could not auto-detect IP. Please find it manually:"
    echo "   macOS: System Settings > Network > WiFi > Details"
    echo "   Or run: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
fi

echo ""
echo "Starting server on port 8000..."
echo "Press Ctrl+C to stop the server"
echo ""

# Start Python server (works on macOS/Linux)
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
else
    echo "❌ Python not found. Please install Python or use VS Code Live Server extension."
    exit 1
fi
