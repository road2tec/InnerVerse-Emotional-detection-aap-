# 📱 Easy Setup Guide - Any Laptop/Network

## 🚀 Quick Setup (30 seconds)

### Method 1: Auto Setup Script (Recommended)
```bash
# Run the magic setup script
./setup.sh

# Follow the prompts, then start:
cd backend && python app.py               # Terminal 1
npx expo start --clear                   # Terminal 2
```

### Method 2: Manual Configuration
```bash
# 1. Find your IP address
ifconfig | grep "inet " | grep -v 127.0.0.1     # Mac/Linux
ipconfig | findstr "IPv4"                        # Windows

# 2. Edit .env file
echo "EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:8000/api" > frontend_expo/.env

# 3. Start servers
cd backend && python app.py               # Terminal 1
cd frontend_expo && npx expo start --clear   # Terminal 2
```

## 🔧 Configuration Options

| Environment | URL Setting | When to Use |
|-------------|-------------|-------------|
| **Physical Device** | `http://192.168.1.x:8000/api` | Real phone testing |
| **Android Emulator** | `http://10.0.2.2:8000/api` | Android Studio emulator |
| **iOS Simulator** | `http://127.0.0.1:8000/api` | Xcode simulator |
| **Expo Tunnel** | `https://xxx.ngrok.io/api` | Network restrictions |

## 🆘 Troubleshooting

### "Network Error" / "Cannot reach backend"
1. **Check IP:** Run `./setup.sh` again
2. **Check Backend:** Visit `http://YOUR_IP:8000/docs` in browser
3. **Check WiFi:** Phone and laptop on same network?
4. **Try Localhost:** Use `127.0.0.1` for simulators

### "Connection Refused"
```bash
# Make sure backend is running
cd backend
python app.py

# Should see: "Uvicorn running on http://0.0.0.0:8000"
```

### "Different Network/Laptop"
```bash
# Just run setup again
./setup.sh
# Select your new IP/environment
```

## 🎯 Network Detection

The app automatically detects:
- ✅ Environment variables from `.env`
- ✅ Platform (iOS/Android/Physical device)
- ✅ Fallback URLs based on device type
- ✅ Debug logs in console

## 📱 For Other Teammates

1. **Clone repo**
2. **Run `./setup.sh`**
3. **Start backend + frontend**
4. **Done!**

No more hardcoded IPs! 🎉