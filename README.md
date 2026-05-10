# Smart Notes — Encrypted Notes App

A mobile-first, end-to-end encrypted notes application inspired by Zoho Notebook and Evernote.

## Architecture

```
Mobile App / PWA (Vite + React + TypeScript + Tailwind)
    ↓
IndexedDB (browser) / SQLite (Capacitor mobile)
    ↓
AES-256-GCM Encryption Layer (Web Crypto API)
    ↓
Sync Queue (offline-first)
    ↓
FastAPI Backend
    ↓
MySQL Database
```

## Tech Stack

**Frontend**
- Vite + React + TypeScript
- Tailwind CSS (dark theme)
- TipTap rich text editor
- Zustand state management
- TanStack Query
- IndexedDB (idb) for local storage
- Web Crypto API (AES-GCM encryption)
- PWA (vite-plugin-pwa)
- Capacitor (Android/iOS)

**Backend**
- FastAPI (Python)
- SQLAlchemy async + aiomysql
- MySQL 8.0
- JWT + refresh tokens
- bcrypt password hashing

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Set up MySQL (root password: 123456)
mysql -u root -p < migrations/init.sql

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Mobile (Android)

```bash
cd frontend
npm run build
npx cap add android
npx cap sync
npx cap open android
```

## Security Architecture

- **AES-256-GCM** encryption for all note content
- **PBKDF2** (310,000 iterations, SHA-256) for key derivation from password
- **Master key** wrapped with password-derived key — server never sees plaintext
- **Recovery key** (32-byte random, hex encoded) for password reset without data loss
- **Server stores encrypted payloads only** — zero-knowledge design
- **JWT access tokens** (60 min) + refresh tokens (30 days)
- **Offline login** using local encrypted vault

## Features

- ✅ Login / Signup / Forgot Password / Reset Password
- ✅ End-to-end encryption (AES-GCM)
- ✅ Offline-first (IndexedDB)
- ✅ Rich text editor (TipTap) with full formatting
- ✅ Checklist notes
- ✅ Note colors, pin, favorite, archive, trash
- ✅ Notebooks organization
- ✅ Tags
- ✅ Search with filters
- ✅ Sync queue (offline → server)
- ✅ Bottom navigation (mobile)
- ✅ PWA installable
- ✅ Dark theme
- 🔲 Audio notes (requires Capacitor)
- 🔲 Photo notes (requires Capacitor camera)
- 🔲 File attachments
- 🔲 Google Drive encrypted backup

## Database

MySQL root password: `123456`  
Database: `smart_notes`

Run `migrations/init.sql` to create all tables.

## Environment Variables

### Backend (.env)
```
SECRET_KEY=your-secret-key-min-32-chars
DATABASE_URL=mysql+aiomysql://root:123456@localhost:3306/smart_notes
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000/api
```
