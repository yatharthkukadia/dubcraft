# DubCraft (AI Video Dubbing)

DubCraft is a full-stack AI video-dubbing app. Upload a video, transcribe speech, translate it, and generate a dubbed audio track that gets merged back into the video — with real-time progress updates.

## Demo
<video src="assets/Screen%20Recording%202026-04-02%20013452.mp4" controls width="800"></video>

If your Markdown renderer doesn't show the player, download it here: [Demo video](assets/Screen%20Recording%202026-04-02%20013452.mp4).


## Features
- Video upload and project management
- Speech-to-text via **Faster-Whisper** (CPU-friendly)
- Translation via **Google Translate**
- Text-to-speech via **gTTS**
- FFmpeg-based audio/video merge
- Real-time progress via WebSockets
- Analytics endpoint and dashboard pages

## Tech Stack
- **Frontend:** React + CRACO
- **Backend:** FastAPI + MongoDB
- **Media:** FFmpeg

---

## Prerequisites
- **Python 3.10+**
- **Node.js 18+** (for frontend)
- **MongoDB** (local or remote)
- **FFmpeg** (must be available in PATH)
- Internet access (for Google Translate + gTTS)

---

## Installation (from GitHub)
```bash
git clone <YOUR_GITHUB_REPO_URL>
cd dubcraft
```

> Replace `<YOUR_GITHUB_REPO_URL>` with your repo URL.

---

## Configuration
Create a `.env` file inside `backend/`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dubcraft
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=change-this-to-a-strong-32-char-min-key
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

> **Note (Windows paths):**
> Uploads and outputs are currently hard-coded to:
> `C:\Users\yskko\OneDrive\Desktop\dubcraft\uploads` and `C:\Users\yskko\OneDrive\Desktop\dubcraft\outputs`
> If you are on a different machine, update these paths in `backend/server.py`.

---

## Run the Backend
**Windows (PowerShell):**
```powershell
cd "C:\Users\yskko\OneDrive\Desktop\dubcraft\backend"

# Fix typer/click conflict
(Get-Content requirements.txt) -replace 'typer==0.24.1','typer==0.23.0' | Set-Content requirements.txt

py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**macOS/Linux:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

---

## Run the Frontend
**Windows (PowerShell):**
```powershell
cd "C:\Users\yskko\OneDrive\Desktop\dubcraft\frontend"

yarn install
$env:REACT_APP_BACKEND_URL="http://localhost:8000"
yarn start
```

**macOS/Linux:**
```bash
cd frontend
npm install
REACT_APP_BACKEND_URL=http://localhost:8000 npm start
```

Open: http://localhost:3000

---

## How to Use
1. **Register / Login**
2. **Upload a video** from Dashboard
3. **Select target language** and voice style
4. Click **Start** to process
5. Preview or download the dubbed output from **Projects**

---

## Tests
Backend API tests:
```powershell
cd "C:\Users\yskko\OneDrive\Desktop\dubcraft"
.\backend\.venv\Scripts\python backend_test.py
```

Frontend tests:
```powershell
cd frontend
yarn test --watchAll=false
```

---

## Notes
- Stripe checkout is optional and will return **503** if Stripe integration isnt installed.
- For production, set `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and use HTTPS.

---

## License
Add your license here.

