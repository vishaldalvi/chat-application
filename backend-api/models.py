from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class ChatType(str, Enum):
    DIRECT = "direct"
    GROUP = "group"
    CHANNEL = "channel"


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    profile_picture: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    profile_picture: Optional[str] = None
    role: UserRole
    created_at: datetime


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ChatCreate(BaseModel):
    name: Optional[str] = None
    chat_type: ChatType
    participants: List[str]  # user IDs
    description: Optional[str] = None


class ChatResponse(BaseModel):
    id: str
    name: Optional[str]
    chat_type: ChatType
    participants: List[str]
    participant_usernames: List[str]
    description: Optional[str]
    created_by: str
    created_at: datetime
    last_message: Optional[Dict[str, Any]] = None


class MessageCreate(BaseModel):
    chat_id: str
    content: Optional[str] = None
    message_type: str = "text"
    reply_to: Optional[str] = None
    # File fields will come from form data, not JSON


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    content: Optional[str]
    sender_id: str
    sender_username: str
    message_type: str
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    created_at: datetime
    reply_to: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat(), ObjectId: lambda v: str(v)}


class TypingIndicator(BaseModel):
    chat_id: str
    user_id: str
    username: str
    is_typing: bool


class OnlineStatus(BaseModel):
    user_id: str
    username: str
    is_online: bool
    last_seen: datetime
