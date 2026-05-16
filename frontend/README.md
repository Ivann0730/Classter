# ClassTer Setup Guide

This repository contains the ClassTer frontend app, and the full software stack includes a backend service in `backend/`.

## Prerequisites

- Node.js 18.x or later
- npm 10.x or later
- A Cardano wallet browser extension such as Lace
- A Blockfrost project ID for Cardano preprod access

## Backend Setup

1. Open a terminal and go to the backend folder:
   ```powershell
   cd ..\backend
   ```
2. Install backend dependencies:
   ```powershell
   npm install
   ```
3. Create a `.env` file in `backend/` with your Blockfrost key:
   ```text
   BLOCKFROST_KEY=your_blockfrost_project_id
   ```
4. Start the backend server:
   ```powershell
   node server.js
   ```
5. The backend runs at:
   - `http://localhost:4000`

> The backend schema is created automatically in `backend/classter.db` when the server starts.

## Frontend Setup

1. Open a new terminal and go to the frontend folder:
   ```powershell
   cd frontend
   ```
2. Install frontend dependencies:
   ```powershell
   npm install
   ```
3. Start the frontend development server:
   ```powershell
   npm start
   ```
4. Open the app in your browser:
   - `http://localhost:3000`

## Available Frontend Commands

- `npm start` — start the development server
- `npm run build` — build the production app
- `npm test` — run tests

## How to Use

- Register students and wallet addresses using the frontend UI.
- Start a teacher session to generate a QR code.
- Students can check in using the session key.
- Attendance, sessions, and students are stored in SQLite.

## Notes

- If wallet connection fails, make sure Lace is installed and enabled in your browser.
- If the backend fails due to schema issues, restart the backend after applying any code fixes.
- The frontend uses CRACO and custom polyfills for Cardano wallet compatibility.
- When deploying the frontend separate from the backend, set `REACT_APP_API_BASE` to your backend URL.

## Railway deployment notes

Railway can host the backend service, but be aware that `better-sqlite3` stores data in a local SQLite file. Railway's filesystem is ephemeral, so this setup is good for testing only. For a production-quality deployment, consider a managed database instead of SQLite.

### Deploying the backend on Railway

1. Install Railway CLI and log in:
   ```bash
   npm install -g railway
   railway login
   ```
2. From the `backend/` folder, run:
   ```bash
   railway init
   railway up
   ```
3. Add your Blockfrost key to Railway environment variables:
   ```bash
   railway variables set BLOCKFROST_KEY your_blockfrost_project_id
   ```
4. If you want to keep the SQLite file name configurable, also set:
   ```bash
   railway variables set DB_FILE classter.db
   ```

### Frontend environment

When the backend is deployed, configure your frontend deployment to use:

```bash
REACT_APP_API_BASE=https://your-railway-backend-url
```

## Deploying the frontend to Vercel

1. Create a new Vercel project and connect your GitHub repository.
2. In Vercel, set the root directory to `frontend`.
3. Set the environment variable:
   ```bash
   REACT_APP_API_BASE=https://your-railway-backend-url
   ```
4. Use these Vercel settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `build`
5. Deploy the project.

> If you use the Vercel CLI from inside `frontend/`, run:
>
> ```bash
> cd frontend
> vercel
> ```

## Helpful Links

- Blockfrost: https://blockfrost.io
- Cardano Lace Wallet: https://lace.io
- React: https://reactjs.org
