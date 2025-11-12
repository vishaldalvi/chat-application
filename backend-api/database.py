from motor.motor_asyncio import AsyncIOMotorClient
import os
from decouple import config


class MongoDB:
    def __init__(self):
        self.client = None
        self.database = None

    async def connect(self):
        """Connect to MongoDB"""
        MONGODB_URL = config("MONGODB_URL", "mongodb://localhost:27017")
        self.client = AsyncIOMotorClient(MONGODB_URL)
        self.database = self.client.chat_app
        print("Connected to MongoDB")

    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()

    def get_collection(self, collection_name):
        """Get a collection from database"""
        return self.database[collection_name]


# MongoDB collections
class Collections:
    USERS = "users"
    CHATS = "chats"
    MESSAGES = "messages"
    USER_SESSIONS = "user_sessions"


# Create database instance
mongodb = MongoDB()
