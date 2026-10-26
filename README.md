# Job Application Tracker

Track job applications with private accounts: add, edit, search, filter and update the status of each application.

- **client/**: React + Vite frontend
- **server/**: Express + MongoDB (Mongoose) API with JWT authentication

## Run locally

1. Copy `server/.env.example` to `server/.env` and fill in `MONGO_URI` and `JWT_SECRET`.
2. Start the API:
   ```bash
   cd server
   npm install
   npm run dev
   ```
3. Start the frontend in another terminal:
   ```bash
   cd client
   npm install
   npm run dev
   ```

The frontend calls `http://localhost:5001/api` unless `VITE_API_URL` is set.

## API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | – | Create an account `{ name, email, password }` |
| POST | `/api/auth/login` | – | Log in `{ email, password }` |
| GET | `/api/auth/me` | Bearer | Current user |
| GET | `/api/jobs` | Bearer | List your applications |
| POST | `/api/jobs` | Bearer | Add an application |
| PATCH | `/api/jobs/:id` | Bearer | Update fields or status |
| DELETE | `/api/jobs/:id` | Bearer | Delete an application |

## Deploy

**Backend (Render):** create a Web Service from this repo (or use `render.yaml`) with root directory `server`, build `npm install`, start `npm start`. Set `MONGO_URI`, `JWT_SECRET` and `CLIENT_URL` (your Vercel URL). In MongoDB Atlas, allow access from Render (Network Access → `0.0.0.0/0`).

**Frontend (Vercel):** import the repo with root directory `client` (Vite preset) and set `VITE_API_URL` to `https://<your-render-service>.onrender.com/api`.
