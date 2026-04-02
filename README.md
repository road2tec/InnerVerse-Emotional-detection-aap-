# InnerVerse
# Emotion Based Activity Recommendation System

> **Phase 1: Project Setup Complete** ✅

A full-stack mobile application that detects user emotions from text, voice, and facial expressions, then recommends suitable activities based on the detected emotion and user age group.

---

## 🏗️ Architecture 

```
┌─────────────────────────────────────────────────────┐
│              React Native Mobile App                │
│  HomeScreen | DetectScreen | ResultsScreen          │
│  LoginScreen | RegisterScreen | HistoryScreen       │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP (Axios)
┌──────────────────▼──────────────────────────────────┐
│              Python FastAPI Backend                 │
│  /api/users | /api/emotion | /api/recommendations   │
│  Transformers | OpenCV | Librosa | PyMongo          │
└──────────────────┬──────────────────────────────────┘
                   │ PyMongo / Motor
┌──────────────────▼──────────────────────────────────┐
│         MongoDB (emotion_app database)                  │
│  Collections: users | emotion_history | recommendations │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
P24-Activity Recommendation System/
├── backend/
│   ├── app.py                  # FastAPI entry point
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Environment variables
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user_model.py       # Pydantic user models
│   │   ├── emotion_model.py    # Pydantic emotion models
│   │   └── recommendation_model.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── user_routes.py      # Registration, login, profile
│   │   ├── emotion_routes.py   # Text, facial, voice detection
│   │   └── recommendation_routes.py
│   ├── services/
│   │   └── emotion_service.py  # ML emotion detection logic
│   ├── utils/
│   │   ├── db.py               # MongoDB connection + seed data
│   │   └── auth.py             # JWT + bcrypt utilities
│   └── ml_models/              # Custom model placeholder
│
├── frontend/
│   ├── App.js                  # Root entry point
│   ├── package.json
│   └── src/
│       ├── navigation/
│       │   └── AppNavigator.js # Stack + Tab navigation
│       ├── screens/
│       │   ├── HomeScreen.js
│       │   ├── DetectScreen.js
│       │   ├── ResultsScreen.js
│       │   ├── LoginScreen.js
│       │   ├── RegisterScreen.js
│       │   ├── ProfileScreen.js
│       │   └── HistoryScreen.js
│       ├── services/
│       │   ├── api.js           # Axios + interceptors
│       │   ├── emotionService.js
│       │   └── authService.js
│       └── utils/
│           └── emotionUtils.js
│
└── setup_backend.sh             # Backend setup script
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (running locally on port 27017)
- React Native environment (Android Studio / Xcode)

### 1. Start MongoDB
```bash
# Using MongoDB Compass GUI or:
mongod --dbpath /data/db
```

### 2. Setup & Start Backend
```bash
chmod +x setup_backend.sh
./setup_backend.sh

# Then start the server:
cd backend
source venv/bin/activate
python app.py
```

Backend runs at: **http://localhost:8000**  
Swagger Docs: **http://localhost:8000/docs**

### 3. Setup & Start Frontend
```bash
cd frontend
npm install
npx react-native run-android    # For Android
npx react-native run-ios        # For iOS
```

> **Note for physical device**: Change `BASE_URL` in `src/services/api.js` from `10.0.2.2` to your machine's local IP address.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register new user |
| POST | `/api/users/login` | Login + get JWT token |
| GET | `/api/users/me` | Get current user profile |
| GET | `/api/users/history/{user_id}` | Get emotion history |
| POST | `/api/emotion/text` | Detect emotion from text |
| POST | `/api/emotion/facial` | Detect from face image |
| POST | `/api/emotion/voice` | Detect from audio |
| POST | `/api/recommendations/` | Get activity recommendations |
| GET | `/api/recommendations/all` | All recommendation data |

---

## 🎭 Supported Emotions

| Emotion | Emoji |
|---------|-------|
| Happy.    | 😊 |
| Sad       | 😢 |
| Angry.    | 😠 |
| Anxious   | 😰 |
| Neutral   | 😐 |
| Surprised | 😲 |
| Disgusted | 🤢 |
| Fearful   | 😨 |

---

## 👥 Age Groups
- **Child** (0-12)
- **Teen** (13-19)
- **Adult** (20-59)
- **Senior** (60+)

---

## 📋 Development Phases

- [ ] **Phase 1**: Project Setup (Backend + Frontend structure, MongoDB)
- [ ] **Phase 2**: Camera + Voice integration
- [ ] **Phase 3**: Advanced ML models (DeepFace, custom audio classifier)
- [ ] **Phase 4**: User dashboard & analytics
- [ ] **Phase 5**: Production deployment
