from fastapi import (
    FastAPI,
    HTTPException,
    status,
    Depends,
    Form,
    UploadFile,
    File,
    WebSocket,
    WebSocketDisconnect,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from bson import ObjectId
from typing import List, Optional
import json
import uuid
import os
from database import mongodb, Collections
from models import (
    UserCreate,
    UserResponse,
    UserLogin,
    Token,
    ChatCreate,
    ChatResponse,
    MessageCreate,
    MessageResponse,
    TypingIndicator,
    OnlineStatus,
    ChatType,
    MessageType,
)
from auth import AuthHandler, get_current_user
from centrifugo_client import centrifugo_client
import logging
from bson import ObjectId
from fastapi.staticfiles import StaticFiles

# Serve uploaded files

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chat App", version="1.0.0")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://10.10.7.30:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization"],
)

UPLOAD_DIRECTORY = "uploads"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    await mongodb.connect()
    # Create indexes
    users_collection = mongodb.get_collection(Collections.USERS)
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)

    chats_collection = mongodb.get_collection(Collections.CHATS)
    await chats_collection.create_index("participants")

    messages_collection = mongodb.get_collection(Collections.MESSAGES)
    await messages_collection.create_index("chat_id")
    await messages_collection.create_index([("chat_id", 1), ("created_at", -1)])


@app.on_event("shutdown")
async def shutdown_event():
    await mongodb.close()


# Utility functions
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable format (including _id and datetime)."""
    if not doc:
        return doc

    # Convert _id to string and rename it to "id"
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]

    # Recursively convert datetime objects
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
        elif isinstance(value, dict):
            doc[key] = serialize_doc(value)
        elif isinstance(value, list):
            doc[key] = [
                (
                    serialize_doc(v)
                    if isinstance(v, dict)
                    else (v.isoformat() if isinstance(v, datetime) else v)
                )
                for v in value
            ]

    return doc


def save_upload_file(upload_file: UploadFile) -> dict:
    """Save uploaded file and return file info"""
    # Generate unique filename
    file_extension = os.path.splitext(upload_file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"

    file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)

    # Save file
    with open(file_path, "wb") as buffer:
        content = upload_file.file.read()
        buffer.write(content)

    return {
        "file_path": file_path,
        "file_name": upload_file.filename,
        "file_size": len(content),
        "file_type": upload_file.content_type,
    }


# Auth APIs
@app.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    users_collection = mongodb.get_collection(Collections.USERS)

    # Check if user already exists
    existing_user = await users_collection.find_one(
        {"$or": [{"email": user_data.email}, {"username": user_data.username}]}
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or username already exists",
        )

    # Create user
    user_dict = user_data.dict()
    user_dict["password"] = AuthHandler.get_password_hash(user_data.password)
    user_dict["role"] = "user"
    user_dict["created_at"] = datetime.now()

    result = await users_collection.insert_one(user_dict)
    user_dict["id"] = str(result.inserted_id)

    return UserResponse(**user_dict)


@app.post("/auth/login", response_model=Token)
async def login(login_data: UserLogin):
    users_collection = mongodb.get_collection(Collections.USERS)

    user = await users_collection.find_one({"email": login_data.email})
    if not user or not AuthHandler.verify_password(
        login_data.password, user["password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    # Update online status
    await users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_seen": datetime.now(), "is_online": True}},
    )

    # Create token
    access_token = AuthHandler.create_access_token(data={"sub": str(user["_id"])})

    user_response = UserResponse(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        profile_picture=user.get("profile_picture"),
        role=user["role"],
        created_at=user["created_at"],
    )

    return Token(access_token=access_token, token_type="bearer", user=user_response)


@app.post("/auth/logout")
async def logout(current_user: UserResponse = Depends(get_current_user)):
    users_collection = mongodb.get_collection(Collections.USERS)

    await users_collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"is_online": False, "last_seen": datetime.now()}},
    )

    return {"message": "Logged out successfully"}


# Centrifugo token endpoint
@app.get("/centrifugo/token")
async def get_centrifugo_token(current_user: UserResponse = Depends(get_current_user)):
    token = centrifugo_client.generate_token(current_user.id)
    return {"token": token}


# User APIs
@app.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: UserResponse = Depends(get_current_user),
):
    return current_user


@app.get("/users", response_model=List[UserResponse])
async def get_users(
    search: Optional[str] = None, current_user: UserResponse = Depends(get_current_user)
):
    users_collection = mongodb.get_collection(Collections.USERS)

    query = {}
    if search:
        query["$or"] = [
            {"username": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    users = await users_collection.find(query).to_list(100)
    return [UserResponse(**serialize_doc(user)) for user in users]


# Chat APIs
@app.post("/chats", response_model=ChatResponse)
async def create_chat(
    chat_data: ChatCreate, current_user: UserResponse = Depends(get_current_user)
):
    chats_collection = mongodb.get_collection(Collections.CHATS)
    users_collection = mongodb.get_collection(Collections.USERS)

    # For direct chats, check if chat already exists
    if chat_data.chat_type == ChatType.DIRECT:
        existing_chat = await chats_collection.find_one(
            {
                "chat_type": ChatType.DIRECT,
                "participants": {"$all": chat_data.participants},
            }
        )

        if existing_chat:
            # Add participant_usernames to existing chat
            existing_chat_data = serialize_doc(existing_chat)
            # Get participants' usernames for existing chat
            participant_usernames = []
            for participant_id in existing_chat_data["participants"]:
                user = await users_collection.find_one(
                    {"_id": ObjectId(participant_id)}
                )
                if user:
                    participant_usernames.append(
                        participant_id + "||||" + user.get("username", "Unknown")
                    )
            existing_chat_data["participant_usernames"] = participant_usernames
            return ChatResponse(**existing_chat_data)

    # Create chat
    chat_dict = chat_data.dict()
    chat_dict["created_by"] = current_user.id
    chat_dict["created_at"] = datetime.now()

    # Ensure creator is in participants
    if current_user.id not in chat_dict["participants"]:
        chat_dict["participants"].append(current_user.id)

    result = await chats_collection.insert_one(chat_dict)
    chat_dict["id"] = str(result.inserted_id)

    # Get participants' usernames for new chat
    participant_usernames = []
    for participant_id in chat_dict["participants"]:
        user = await users_collection.find_one({"_id": ObjectId(participant_id)})
        if user:
            participant_usernames.append(
                participant_id + "||||" + user.get("username", "Unknown")
            )

    # Add participants usernames to response
    chat_dict["participant_usernames"] = participant_usernames

    return ChatResponse(**chat_dict)


@app.get("/chats", response_model=List[ChatResponse])
async def get_user_chats(current_user: UserResponse = Depends(get_current_user)):
    chats_collection = mongodb.get_collection(Collections.CHATS)
    users_collection = mongodb.get_collection(Collections.USERS)

    chats = (
        await chats_collection.find({"participants": current_user.id})
        .sort("created_at", -1)
        .to_list(100)
    )

    # Get last message for each chat and participants' usernames
    messages_collection = mongodb.get_collection(Collections.MESSAGES)

    chat_responses = []
    for chat in chats:
        chat_data = serialize_doc(chat)

        # Get last message
        last_message = await messages_collection.find_one(
            {"chat_id": chat_data["id"]}, sort=[("created_at", -1)]
        )

        if last_message:
            chat_data["last_message"] = serialize_doc(last_message)

        # Get participants' usernames
        participant_usernames = []
        for participant_id in chat_data["participants"]:
            user = await users_collection.find_one({"_id": ObjectId(participant_id)})
            if user:
                participant_usernames.append(
                    participant_id + "||||" + user.get("username", "Unknown")
                )

        # Add participants usernames to response
        chat_data["participant_usernames"] = participant_usernames

        chat_responses.append(ChatResponse(**chat_data))

    return chat_responses


@app.get("/chats/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: str, current_user: UserResponse = Depends(get_current_user)
):
    chats_collection = mongodb.get_collection(Collections.CHATS)

    chat = await chats_collection.find_one(
        {"_id": ObjectId(chat_id), "participants": current_user.id}
    )

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )

    return ChatResponse(**serialize_doc(chat))


@app.post("/messages", response_model=MessageResponse)
async def send_message(
    request: Request,
    chat_id: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    message_type: Optional[str] = Form("text"),
    reply_to: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: UserResponse = Depends(get_current_user),
):
    try:
        if request.headers.get("content-type", "").startswith("application/json"):
            data = await request.json()
            chat_id = data.get("chat_id")
            content = data.get("content")
            message_type = data.get("message_type", "text")
            reply_to = data.get("reply_to")

        if not chat_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chat ID is required.",
            )

        chats_collection = mongodb.get_collection(Collections.CHATS)
        messages_collection = mongodb.get_collection(Collections.MESSAGES)

        # Verify chat exists and user is participant
        chat = await chats_collection.find_one(
            {"_id": ObjectId(chat_id), "participants": current_user.id}
        )

        if not chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found or access denied",
            )

        # Handle file upload if present
        file_info = None
        if file and message_type == "file":
            try:
                # Validate file size (e.g., 10MB limit)
                max_size = 10 * 1024 * 1024
                file_content = await file.read()

                if len(file_content) > max_size:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File size too large. Maximum size is 10MB.",
                    )

                # Reset file pointer after reading
                await file.seek(0)

                # Save file and get file info
                file_info = save_upload_file(file)

            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error processing file: {str(e)}",
                )

        # Create message document
        message_dict = {
            "chat_id": chat_id,
            "content": content,
            "sender_id": current_user.id,
            "sender_username": current_user.username,
            "message_type": message_type,
            "created_at": datetime.now(),
            "reply_to": reply_to,
        }

        # Add file info if available
        if file_info:
            message_dict.update(
                {
                    "file_path": file_info["file_path"],
                    "file_name": file_info["file_name"],
                    "file_size": file_info["file_size"],
                    "file_type": file_info["file_type"],
                }
            )

        # Insert message into database
        result = await messages_collection.insert_one(message_dict)
        message_dict["id"] = str(result.inserted_id)

        # Serialize for Centrifugo
        serialized_message = serialize_doc(message_dict.copy())

        # Prepare Centrifugo message data
        centrifugo_data = {
            "type": "new_message",
            "message": serialized_message,
            "chat_id": chat_id,
            "sender_id": current_user.id,
            "timestamp": datetime.now().isoformat(),
        }

        # Publish to Centrifugo
        publish_success = await centrifugo_client.publish(
            channel=f"chat-{chat_id}",
            data=centrifugo_data,
        )

        if not publish_success:
            logger.error(f"Failed to publish message to Centrifugo for chat {chat_id}")

        # Update chat's last activity
        await chats_collection.update_one(
            {"_id": ObjectId(chat_id)},
            {"$set": {"last_activity": datetime.now()}},
        )

        return MessageResponse(**message_dict)
    except Exception as e:
        raise e


@app.get("/chats/{chat_id}/messages", response_model=List[MessageResponse])
async def get_chat_messages(
    chat_id: str,
    page: int = 1,
    limit: int = 50,
    current_user: UserResponse = Depends(get_current_user),
):
    chats_collection = mongodb.get_collection(Collections.CHATS)
    messages_collection = mongodb.get_collection(Collections.MESSAGES)

    # Verify chat exists and user is participant
    chat = await chats_collection.find_one(
        {"_id": ObjectId(chat_id), "participants": current_user.id}
    )

    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat not found or access denied",
        )

    # Get messages with pagination
    skip = (page - 1) * limit
    messages = (
        await messages_collection.find({"chat_id": chat_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

    messages.reverse()  # Return in chronological order

    return [MessageResponse(**serialize_doc(msg)) for msg in messages]


# Typing indicator API
@app.post("/typing")
async def send_typing_indicator(
    typing_data: TypingIndicator, current_user: UserResponse = Depends(get_current_user)
):
    # Publish typing indicator to Centrifugo
    await centrifugo_client.publish(
        channel=f"chat-{typing_data.chat_id}",
        data={
            "type": "typing_indicator",
            "user_id": current_user.id,
            "username": current_user.username,
            "is_typing": typing_data.is_typing,
        },
    )

    return {"status": "sent"}


# Online status API
@app.post("/online-status")
async def update_online_status(
    status_data: OnlineStatus, current_user: UserResponse = Depends(get_current_user)
):
    users_collection = mongodb.get_collection(Collections.USERS)

    await users_collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"is_online": status_data.is_online, "last_seen": datetime.now()}},
    )

    # Broadcast online status to user's chats
    chats_collection = mongodb.get_collection(Collections.CHATS)
    user_chats = await chats_collection.find({"participants": current_user.id}).to_list(
        100
    )

    for chat in user_chats:
        await centrifugo_client.publish(
            channel=f"chat-{str(chat['_id'])}",
            data={
                "type": "online_status",
                "user_id": current_user.id,
                "username": current_user.username,
                "is_online": status_data.is_online,
            },
        )

    return {"status": "updated"}


@app.get("/health")
async def health():
    return {"status": "ok"}


# WebSocket endpoint for real-time communication
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Handle WebSocket messages if needed
            # Most real-time communication is handled by Centrifugo
            await websocket.send_text(f"Message received: {data}")
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user {user_id}")


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)


# Add these to your main FastAPI app


@app.get("/debug/centrifugo-test")
async def debug_centrifugo_test(current_user: UserResponse = Depends(get_current_user)):
    """Test Centrifugo connection and publishing"""
    test_channel = f"test:{current_user.id}"
    test_data = {
        "type": "test_message",
        "message": "This is a test message",
        "timestamp": datetime.now().isoformat(),
        "user_id": current_user.id,
    }

    success = await centrifugo_client.publish(channel=test_channel, data=test_data)

    return {
        "status": "success" if success else "failed",
        "channel": test_channel,
        "data": test_data,
        "user_id": current_user.id,
    }


@app.get("/debug/centrifugo-online/{chat_id}")
async def debug_centrifugo_online(
    chat_id: str, current_user: UserResponse = Depends(get_current_user)
):
    """Check online users in a chat channel"""
    online_users = await centrifugo_client.get_online_users(f"chat-{chat_id}")

    return {"chat_id": chat_id, "online_users": online_users or []}


@app.get("/debug/centrifugo-token")
async def debug_centrifugo_token(
    current_user: UserResponse = Depends(get_current_user),
):
    """Get Centrifugo token for testing"""
    token = centrifugo_client.generate_token(current_user.id)

    return {"user_id": current_user.id, "token": token}
