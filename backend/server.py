from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import mimetypes
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from bson import ObjectId
import secrets
import asyncio
import json
try:
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout,
        CheckoutSessionResponse,
        CheckoutStatusResponse,
        CheckoutSessionRequest,
    )
except ImportError:
    StripeCheckout = None
    CheckoutSessionResponse = None
    CheckoutStatusResponse = None
    CheckoutSessionRequest = None
from ai_processor import processor, INDIAN_LANGUAGES

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')

# Cookie helpers
def _get_cookie_settings(request: Request) -> dict:
    secure_env = os.environ.get("COOKIE_SECURE")
    if secure_env is not None:
        secure = secure_env.lower() == "true"
    else:
        forwarded_proto = request.headers.get("x-forwarded-proto")
        secure = (forwarded_proto or request.url.scheme) == "https"
    samesite_env = os.environ.get("COOKIE_SAMESITE")
    if samesite_env:
        samesite = samesite_env.lower()
    else:
        samesite = "none" if secure else "lax"
    if samesite == "none" and not secure:
        samesite = "lax"
    return {"secure": secure, "samesite": samesite, "path": "/"}

def set_auth_cookies(response: JSONResponse, access_token: str, refresh_token: str, request: Request):
    settings = _get_cookie_settings(request)
    response.set_cookie(key="access_token", value=access_token, httponly=True, max_age=900, **settings)
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, max_age=604800, **settings)

def clear_auth_cookies(response: JSONResponse, request: Request):
    settings = _get_cookie_settings(request)
    response.delete_cookie("access_token", path=settings["path"], samesite=settings["samesite"], secure=settings["secure"])
    response.delete_cookie("refresh_token", path=settings["path"], samesite=settings["samesite"], secure=settings["secure"])

# CORS settings
def get_cors_settings():
    raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    if not origins:
        origins = ["http://localhost:3000"]
    allow_credentials = True
    if "*" in origins:
        allow_credentials = False
        origins = ["*"]
        logger.warning("CORS_ORIGINS includes '*'; disabling credentials.")
    return origins, allow_credentials


# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# File upload directory
UPLOAD_DIR = Path(r"C:\\Users\\yskko\\OneDrive\\Desktop\\dubcraft\\uploads")
OUTPUT_DIR = Path(r"C:\\Users\\yskko\\OneDrive\\Desktop\\dubcraft\\outputs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Credit packages
CREDIT_PACKAGES = {
    "starter": {"amount": 10.0, "credits": 100},
    "pro": {"amount": 25.0, "credits": 300},
    "premium": {"amount": 50.0, "credits": 700}
}

# Subscription plans
SUBSCRIPTION_PLANS = {
    "basic": {"price_per_month": 19.0, "credits_per_month": 200},
    "pro": {"price_per_month": 49.0, "credits_per_month": 600},
    "enterprise": {"price_per_month": 99.0, "credits_per_month": 1500}
}

# Password hashing utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# JWT utilities
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Get current user dependency
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            return None
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

# Models
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(alias="_id")
    name: str
    email: str
    credits: int = 0
    trial_credits: int = 0
    role: str = "user"
    created_at: datetime

class ProjectCreate(BaseModel):
    video_url: str
    voice_instructions: str
    target_language: Optional[str] = "en"

class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    status: str
    video_url: str
    voice_instructions: str
    target_language: str
    output_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Auth endpoints
@api_router.post("/auth/register")
async def register(user_data: RegisterRequest, request: Request):
    email = user_data.email.lower()
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password_hash = hash_password(user_data.password)
    
    new_user = {
        "name": user_data.name,
        "email": email,
        "password_hash": password_hash,
        "credits": 0,
        "trial_credits": 100,
        "role": "user",
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response = JSONResponse(content={
        "_id": user_id,
        "name": new_user["name"],
        "email": new_user["email"],
        "credits": new_user["credits"],
        "trial_credits": new_user["trial_credits"],
        "role": new_user["role"]
    })
    
    set_auth_cookies(response, access_token, refresh_token, request)
    
    return response

@api_router.post("/auth/login")
async def login(credentials: LoginRequest, request: Request):
    email = credentials.email.lower()
    
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response = JSONResponse(content={
        "_id": user_id,
        "name": user["name"],
        "email": user["email"],
        "credits": user.get("credits", 0),
        "trial_credits": user.get("trial_credits", 0),
        "role": user.get("role", "user")
    })
    
    set_auth_cookies(response, access_token, refresh_token, request)
    
    return response

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request):
    response = JSONResponse(content={"message": "Logged out successfully"})
    clear_auth_cookies(response, request)
    return response

# Video upload endpoint
@api_router.post("/upload-video")
async def upload_video(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"file_id": file_id, "filename": file.filename, "url": f"/api/files/{file_id}{file_extension}"}

# Create dubbing project
@api_router.post("/projects")
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(get_current_user)):
    project = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "status": "pending",
        "video_url": project_data.video_url,
        "voice_instructions": project_data.voice_instructions,
        "target_language": project_data.target_language,
        "output_url": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    result = await db.projects.insert_one(project)
    
    # Start processing in background (placeholder for now)
    # In production, this would trigger the AI pipeline
    
    # Return project without the MongoDB _id field
    project.pop("_id", None)  # Remove _id if it exists
    return project

# Get user projects
@api_router.get("/projects")
async def get_projects(current_user: dict = Depends(get_current_user), limit: int = 50, skip: int = 0):
    # Validate pagination params
    limit = min(limit, 100)  # Max 100 items per request
    projects = await db.projects.find(
        {"user_id": current_user["_id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return projects

# Get project by ID
@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# Delete project
@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete output file if exists
    if project.get("output_url"):
        output_path = OUTPUT_DIR / project["output_url"].split("/")[-1]
        if output_path.exists():
            output_path.unlink()
    
    # Delete project from database
    await db.projects.delete_one({"id": project_id, "user_id": current_user["_id"]})
    
    return {"message": "Project deleted successfully"}

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, project_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[project_id] = websocket
    
    def disconnect(self, project_id: str):
        if project_id in self.active_connections:
            del self.active_connections[project_id]
    
    async def send_progress(self, project_id: str, status: str, message: str, data: dict = None):
        if project_id in self.active_connections:
            try:
                payload = {
                    "status": status,
                    "message": message,
                    "data": data or {},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await self.active_connections[project_id].send_text(json.dumps(payload))
            except Exception as e:
                logger.error(f"Error sending progress: {e}")
                self.disconnect(project_id)

manager = ConnectionManager()

# WebSocket endpoint for real-time progress
@app.websocket("/ws/projects/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    token = websocket.cookies.get("access_token")
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        await websocket.close(code=1008)
        return

    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=1008)
        return

    project = await db.projects.find_one({"id": project_id, "user_id": user["_id"]})
    if not project:
        await websocket.close(code=1008)
        return

    await manager.connect(project_id, websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo back for keepalive
            await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        manager.disconnect(project_id)
# Process dubbing project
async def process_dubbing(project_id: str, video_path: str, voice_instructions: str, target_language: str, user_id: str):
    """Background task to process video dubbing"""
    try:
        # Progress callback
        async def progress_callback(status: str, message: str, data: dict = None):
            await manager.send_progress(project_id, status, message, data)
            # Update project status in DB
            await db.projects.update_one(
                {"id": project_id},
                {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
            )
        
        # Initialize processor
        await processor.initialize()
        
        # Step 1: Extract audio
        audio_path = str(UPLOAD_DIR / f"audio_{project_id}.wav")
        success = await processor.extract_audio(video_path, audio_path, progress_callback)
        if not success:
            return
        
        # Step 2: Transcribe audio
        transcription = await processor.transcribe_audio(audio_path, progress_callback)
        if not transcription:
            return
        
        # Step 3: Correct spelling
        corrected_text = await processor.correct_spelling(transcription, progress_callback)
        
        # Step 4: Translate
        translated_text = await processor.translate_text(corrected_text, target_language, progress_callback)
        if not translated_text:
            return
        
        # Save transcription and translation to project
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "transcription": corrected_text,
                "translation": translated_text,
                "status": "review_ready",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        await progress_callback("review_ready", "Text ready for review. You can now edit and confirm.", {
            "transcription": corrected_text,
            "translation": translated_text
        })
        
    except Exception as e:
        logger.error(f"Processing error: {e}")
        await manager.send_progress(project_id, "error", f"Processing failed: {str(e)}")
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.now(timezone.utc)}}
        )

# Start dubbing process
@api_router.post("/projects/{project_id}/start")
async def start_dubbing(project_id: str, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check credits
    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})
    total_credits = user.get("credits", 0) + user.get("trial_credits", 0)
    
    if total_credits < 10:
        raise HTTPException(status_code=400, detail="Insufficient credits")
    
    # Deduct credits
    if user.get("trial_credits", 0) >= 10:
        await db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$inc": {"trial_credits": -10}})
    else:
        remaining = 10 - user.get("trial_credits", 0)
        await db.users.update_one(
            {"_id": ObjectId(current_user["_id"])},
            {"$set": {"trial_credits": 0}, "$inc": {"credits": -remaining}}
        )
    
    # Get video path from upload
    video_url = project["video_url"]
    video_path = UPLOAD_DIR / video_url.split("/")[-1]
    
    # Start processing in background
    background_tasks.add_task(
        process_dubbing,
        project_id,
        str(video_path),
        project["voice_instructions"],
        project["target_language"],
        current_user["_id"]
    )
    
    return {"message": "Processing started", "project_id": project_id}

class ProjectGenerate(BaseModel):
    transcription: str
    translation: str

# Confirm and generate final video
@api_router.post("/projects/{project_id}/generate")
async def generate_final_video(
    project_id: str,
    generate_data: ProjectGenerate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["_id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Update with edited texts
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "transcription": generate_data.transcription,
            "translation": generate_data.translation,
            "status": "generating",
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    # Start final generation
    background_tasks.add_task(generate_dubbed_video, project_id, generate_data.translation, project["voice_instructions"], project["target_language"])
    
    return {"message": "Video generation started"}

async def generate_dubbed_video(project_id: str, translation_text: str, voice_instructions: str, target_language: str):
    """Generate final dubbed video"""
    try:
        async def progress_callback(status: str, message: str, data: dict = None):
            await manager.send_progress(project_id, status, message, data)
        
        # Get project and user
        project = await db.projects.find_one({"id": project_id})
        user = await db.users.find_one({"_id": ObjectId(project["user_id"])})
        video_url = project["video_url"]
        video_path = UPLOAD_DIR / video_url.split("/")[-1]
        
        # Step 5: Extract voice parameters
        await progress_callback("analyzing_voice", "Analyzing voice parameters...")
        voice_params = await processor.extract_voice_parameters(voice_instructions)
        voice_params["language"] = target_language  # Add language to voice params
        
        # Step 6: Generate speech
        audio_output = UPLOAD_DIR / f"dubbed_audio_{project_id}.wav"
        success = await processor.generate_speech(translation_text, voice_params, str(audio_output), progress_callback)
        if not success:
            return
        
        # Step 7: Generate subtitles
        await progress_callback("generating_subtitles", "Generating subtitles...")
        subtitle_output = OUTPUT_DIR / f"subtitles_{project_id}.srt"
        await processor.generate_subtitles(project.get("transcription", ""), str(subtitle_output), progress_callback)

        # Step 8: Merge audio with video (add watermark for trial users)
        video_output = OUTPUT_DIR / f"dubbed_{project_id}.mp4"
        add_watermark = user.get("trial_credits", 0) > 0
        success = await processor.merge_audio_video(
            video_path=str(video_path),
            audio_path=str(audio_output),
            output_path=str(video_output),
            add_watermark=add_watermark,
            progress_callback=progress_callback
        )
        if not success:
            return
        
        # Update project with output
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "output_url": f"/api/outputs/{video_output.name}",
                "subtitle_url": f"/api/outputs/{subtitle_output.name}",
                "has_watermark": add_watermark,
                "status": "completed",
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        await progress_callback("completed", "Your dubbed video is ready!", {
            "output_url": f"/api/outputs/{video_output.name}",
            "subtitle_url": f"/api/outputs/{subtitle_output.name}"
        })
        
    except Exception as e:
        logger.error(f"Generation error: {e}")
        await manager.send_progress(project_id, "error", f"Generation failed: {str(e)}")

# Get available languages
@api_router.get("/languages")
async def get_languages():
    return {"languages": INDIAN_LANGUAGES}

# Get user analytics
@api_router.get("/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    user_id = current_user["_id"]
    
    # Get all user projects
    projects = await db.projects.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    
    # Calculate statistics
    total_projects = len(projects)
    completed_projects = len([p for p in projects if p.get("status") == "completed"])
    failed_projects = len([p for p in projects if p.get("status") in ["error", "failed"]])
    processing_projects = len([p for p in projects if p.get("status") not in ["completed", "error", "failed"]])
    
    # Language breakdown
    language_counts = {}
    for project in projects:
        lang = project.get("target_language", "unknown")
        language_counts[lang] = language_counts.get(lang, 0) + 1
    
    # Get user info
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    initial_credits = 1000 if user_doc.get("role") == "admin" else 0
    credits_used = initial_credits - user_doc.get("credits", 0)
    
    # Credits by month (simplified - last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_projects = [p for p in projects if p.get("created_at") and p.get("created_at").replace(tzinfo=timezone.utc) > thirty_days_ago]
    credits_last_30_days = len(recent_projects) * 10  # 10 credits per project
    
    return {
        "overview": {
            "total_projects": total_projects,
            "completed": completed_projects,
            "failed": failed_projects,
            "processing": processing_projects,
            "credits_used": credits_used,
            "credits_remaining": user_doc.get("credits", 0) + user_doc.get("trial_credits", 0)
        },
        "by_language": language_counts,
        "recent_activity": {
            "projects_last_30_days": len(recent_projects),
            "credits_last_30_days": credits_last_30_days
        },
        "projects": projects[-10:]  # Last 10 projects for timeline
    }

# Download output file
@api_router.get("/outputs/{filename}")
async def download_output(filename: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {
            "user_id": current_user["_id"],
            "$or": [
                {"output_url": f"/api/outputs/{filename}"},
                {"subtitle_url": f"/api/outputs/{filename}"}
            ]
        },
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type or "application/octet-stream", filename=filename)

# Download uploaded file (restricted to owner)
@api_router.get("/files/{filename}")
async def download_uploaded_file(filename: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"user_id": current_user["_id"], "video_url": f"/api/files/{filename}"},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type or "application/octet-stream", filename=filename)

# Stripe payment - create checkout session
@api_router.post("/payments/checkout")
async def create_checkout(request: Request, package_id: str, current_user: dict = Depends(get_current_user)):
    if StripeCheckout is None:
        raise HTTPException(status_code=503, detail="Stripe integration not installed")
    if package_id not in CREDIT_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = CREDIT_PACKAGES[package_id]
    amount = package["amount"]
    credits = package["credits"]
    
    # Get origin from request
    body = await request.json()
    origin_url = body.get("origin_url", "")
    
    if not origin_url:
        raise HTTPException(status_code=400, detail="Origin URL required")
    
    success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/dashboard"
    
    # Initialize Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user["_id"],
            "package_id": package_id,
            "credits": str(credits)
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction
    transaction = {
        "session_id": session.session_id,
        "user_id": current_user["_id"],
        "amount": amount,
        "currency": "usd",
        "package_id": package_id,
        "credits": credits,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

# Check payment status
@api_router.get("/payments/status/{session_id}")
async def check_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    if StripeCheckout is None:
        raise HTTPException(status_code=503, detail="Stripe integration not installed")
    # Initialize Stripe
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    # Get checkout status
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction if paid and not already processed
    if status.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        
        if transaction and transaction["payment_status"] != "completed":
            # Add credits to user
            credits_to_add = transaction["credits"]
            await db.users.update_one(
                {"_id": ObjectId(current_user["_id"])},
                {"$inc": {"credits": credits_to_add}}
            )
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
    
    return status

# Stripe webhook
@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    if StripeCheckout is None:
        raise HTTPException(status_code=503, detail="Stripe integration not installed")
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    webhook_response = await stripe_checkout.handle_webhook(body, signature)
    
    if webhook_response.payment_status == "paid":
        transaction = await db.payment_transactions.find_one({"session_id": webhook_response.session_id})
        
        if transaction and transaction["payment_status"] != "completed":
            user_id = transaction["user_id"]
            credits_to_add = transaction["credits"]
            
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$inc": {"credits": credits_to_add}}
            )
            
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {"payment_status": "completed", "completed_at": datetime.now(timezone.utc)}}
            )
    
    return {"status": "success"}

# Get credit packages
@api_router.get("/credit-packages")
async def get_credit_packages():
    return CREDIT_PACKAGES

# Admin seeding
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "credits": 1000,
            "trial_credits": 0,
            "created_at": datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
    
    # Write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# Test Credentials

Admin Account:
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

Test User:
- Email: testuser@example.com
- Password: testpass123
- Role: user

Auth Endpoints:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
""")

# Startup event
@app.on_event("startup")
async def startup_event():
    await seed_admin()
    await db.users.create_index("email", unique=True)
    await db.projects.create_index("user_id")

# Include the router in the main app
app.include_router(api_router)

# CORS configuration
cors_origins, cors_allow_credentials = get_cors_settings()
app.add_middleware(
    CORSMiddleware,
    allow_credentials=cors_allow_credentials,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()







































