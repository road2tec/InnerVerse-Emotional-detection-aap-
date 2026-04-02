"""
Database Connection Utility using PyMongo (async via Motor)
"""

import motor.motor_asyncio
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "emotion_app")

# Async client (Motor) for FastAPI async endpoints
async_client: motor.motor_asyncio.AsyncIOMotorClient = None
async_db = None

# Sync client (PyMongo) for non-async operations (e.g., data initialization)
sync_client: MongoClient = None
sync_db = None


async def connect_to_mongo():
    """Connect to MongoDB using Motor (async) and PyMongo (sync)."""
    global async_client, async_db, sync_client, sync_db

    try:
        # Async connection
        async_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
        async_db = async_client[DATABASE_NAME]

        # Sync connection
        sync_client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
        sync_db = sync_client[DATABASE_NAME]

        # Verify connection
        await async_client.admin.command("ping")
        logger.info(f"✅ Successfully connected to MongoDB: {DATABASE_NAME}")

        # Initialize collections and indexes
        await initialize_collections()

    except ConnectionFailure as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """Close MongoDB connections."""
    global async_client, sync_client
    if async_client:
        async_client.close()
        logger.info("MongoDB async connection closed.")
    if sync_client:
        sync_client.close()
        logger.info("MongoDB sync connection closed.")


async def initialize_collections():
    """Initialize MongoDB collections and create indexes."""
    global async_db

    # Users collection
    users_collection = async_db["users"]
    await users_collection.create_index("email", unique=True)

    # Emotion History collection
    emotion_history_collection = async_db["emotion_history"]
    await emotion_history_collection.create_index("user_id")
    await emotion_history_collection.create_index("created_at")

    # Recommendations collection
    recommendations_collection = async_db["recommendations"]
    await recommendations_collection.create_index("emotion")
    await recommendations_collection.create_index("age_group")

    logger.info("✅ MongoDB collections and indexes initialized.")

    # Seed initial recommendations data
    await seed_recommendations()


async def seed_recommendations():
    """Seed the recommendations collection with initial activity data."""
    recommendations_collection = async_db["recommendations"]

    count = await recommendations_collection.count_documents({})
    if count > 0:
        logger.info("Recommendations already seeded. Skipping.")
        return

    recommendations = [
        # Happy
        {"emotion": "happy", "age_group": "child", "activities": ["Play outdoor games", "Draw or paint", "Sing and dance", "Read colorful books"], "description": "Fun and energetic activities for happy children"},
        {"emotion": "happy", "age_group": "teen", "activities": ["Play sports", "Hang out with friends", "Listen to music", "Creative writing", "Gaming"], "description": "Social and creative activities for happy teenagers"},
        {"emotion": "happy", "age_group": "adult", "activities": ["Go for a walk", "Cook a new recipe", "Meet friends", "Travel", "Exercise"], "description": "Productive and social activities for happy adults"},
        {"emotion": "happy", "age_group": "senior", "activities": ["Gardening", "Video call family", "Light walking", "Knitting or crafts", "Reading"], "description": "Relaxing and social activities for happy seniors"},
        # Sad
        {"emotion": "sad", "age_group": "child", "activities": ["Watch a favorite cartoon", "Hug a stuffed toy", "Draw feelings", "Talk to parents"], "description": "Comforting activities for sad children"},
        {"emotion": "sad", "age_group": "teen", "activities": ["Journal writing", "Listen to calming music", "Talk to a friend", "Watch a movie", "Take a nap"], "description": "Healing activities for sad teenagers"},
        {"emotion": "sad", "age_group": "adult", "activities": ["Meditate", "Call a close friend", "Go for a walk", "Read a book", "Cook comfort food"], "description": "Uplifting activities for sad adults"},
        {"emotion": "sad", "age_group": "senior", "activities": ["Prayer or meditation", "Call family", "Light stretching", "Listen to old music", "Watch old movies"], "description": "Soothing activities for sad seniors"},
        # Angry
        {"emotion": "angry", "age_group": "child", "activities": ["Deep breathing exercises", "Run or jump outdoors", "Draw emotions", "Talk to a trusted adult"], "description": "Calming activities for angry children"},
        {"emotion": "angry", "age_group": "teen", "activities": ["Exercise or gym", "Write in a journal", "Listen to music", "Go for a run", "Talk to someone"], "description": "Physical release activities for angry teenagers"},
        {"emotion": "angry", "age_group": "adult", "activities": ["Exercise", "Meditation and mindfulness", "Progressive muscle relaxation", "Take a cold shower", "Talk to therapist"], "description": "Stress-relief activities for angry adults"},
        {"emotion": "angry", "age_group": "senior", "activities": ["Deep breathing", "Gentle yoga", "Walk in nature", "Pray or meditate", "Talk to family"], "description": "Calming activities for angry seniors"},
        # Anxious/Fear
        {"emotion": "anxious", "age_group": "child", "activities": ["Talk to parents", "Breathing exercises", "Play with pets", "Coloring or drawing", "Listen to calm music"], "description": "Reassuring activities for anxious children"},
        {"emotion": "anxious", "age_group": "teen", "activities": ["Journaling", "Breathing exercises", "Talk to a counselor", "Yoga", "Study meditation apps"], "description": "Calming activities for anxious teenagers"},
        {"emotion": "anxious", "age_group": "adult", "activities": ["Mindfulness meditation", "Exercise", "Limit news consumption", "Call a friend", "Practice gratitude"], "description": "Grounding activities for anxious adults"},
        {"emotion": "anxious", "age_group": "senior", "activities": ["Gentle deep breathing", "Talk to family", "Light yoga", "Prayer", "Herbal tea and rest"], "description": "Reassuring activities for anxious seniors"},
        # Neutral
        {"emotion": "neutral", "age_group": "child", "activities": ["Read a book", "Solve puzzles", "Learn something new", "Play board games"], "description": "Engaging activities for children in neutral mood"},
        {"emotion": "neutral", "age_group": "teen", "activities": ["Study a new skill", "Watch a documentary", "Exercise", "Cook a new dish", "Play an instrument"], "description": "Productive activities for teens in neutral mood"},
        {"emotion": "neutral", "age_group": "adult", "activities": ["Learn new skills online", "Organize your space", "Exercise", "Read", "Plan goals"], "description": "Productive activities for adults in neutral mood"},
        {"emotion": "neutral", "age_group": "senior", "activities": ["Read the newspaper", "Light gardening", "Watch educational TV", "Do crossword puzzles"], "description": "Engaging activities for seniors in neutral mood"},
        # Surprised
        {"emotion": "surprised", "age_group": "child", "activities": ["Explore something new", "Ask questions and learn", "Creative play", "Watch educational videos"], "description": "Exploratory activities for surprised children"},
        {"emotion": "surprised", "age_group": "teen", "activities": ["Deep dive into a new topic", "Explore a new hobby", "Watch a documentary", "Discuss with friends"], "description": "Discovery activities for surprised teenagers"},
        {"emotion": "surprised", "age_group": "adult", "activities": ["Research the topic", "Try a new experience", "Travel or explore local areas", "Read about it"], "description": "Curiosity-driven activities for surprised adults"},
        {"emotion": "surprised", "age_group": "senior", "activities": ["Discuss with family", "Read about it", "Write about the experience", "Watch a related documentary"], "description": "Reflective activities for surprised seniors"},
        # Disgusted
        {"emotion": "disgusted", "age_group": "child", "activities": ["Switch to a pleasant activity", "Play outdoors", "Watch a fun cartoon", "Talk to parents"], "description": "Distracting activities for disgusted children"},
        {"emotion": "disgusted", "age_group": "teen", "activities": ["Go for a walk", "Listen to music", "Talk to a friend", "Exercise", "Engage in a hobby"], "description": "Diverting activities for disgusted teenagers"},
        {"emotion": "disgusted", "age_group": "adult", "activities": ["Take a break", "Go outside", "Call a friend", "Exercise", "Focus on something pleasant"], "description": "Redirection activities for disgusted adults"},
        {"emotion": "disgusted", "age_group": "senior", "activities": ["Rest and relax", "Engage in prayer", "Call family", "Watch something positive"], "description": "Comforting activities for disgusted seniors"},
    ]

    await recommendations_collection.insert_many(recommendations)
    logger.info(f"✅ Seeded {len(recommendations)} recommendation entries.")


def get_async_db():
    """Get the async database instance."""
    return async_db


def get_sync_db():
    """Get the sync database instance."""
    return sync_db
