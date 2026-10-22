# Veya

Veya — A little closer, with every message. A full-stack direct-messaging app with a React/Vite frontend, an Express API, MongoDB persistence, cookie-based authentication, and Socket.IO message delivery.

## Requirements

- Node.js 20 or newer
- MongoDB connection string

## Configure and run

Copy `.env.example` to `.env` and set these values for local development:

```env
PORT=2405
MONGODB_CONNECT=mongodb://127.0.0.1:27017/goodtalk
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

Install the backend dependencies from the project root and the frontend dependencies from its directory:

```powershell
npm install
npm install --prefix .\frontend-chatapp
```

Start the API and frontend in separate terminals:

```powershell
npm run dev
npm run dev:frontend
```

Open `http://localhost:5173`. The frontend uses `VITE_API_URL` if set; otherwise it connects to `http://localhost:2405`.

## Deployment

### Vercel frontend + Render API + MongoDB Atlas

Push this project to a private GitHub repository first. Do not commit `.env` files or MongoDB credentials.

1. **Deploy the API on Render.** Create a new Blueprint from the repository and let Render use the root `render.yaml`. When prompted, provide:
   - `MONGODB_CONNECT`: the production Atlas connection string, with the production database username and password.
   - `FRONTEND_URL`: the exact Vercel site origin, for example `https://veya-example.vercel.app` (no trailing path).
   Render generates `JWT_SECRET` automatically. Keep it in Render's environment settings and never expose it in frontend variables.
2. Wait until the Render service is live, then open its root URL (for example, `https://veya-api.onrender.com`). It should return `{"success":true,"message":"Chat API is running"}`.
3. **Deploy the frontend on Vercel.** Import the same repository and set the project **Root Directory** to `frontend-chatapp`. Use the Vite defaults (`npm run build`, output directory `dist`). Add `VITE_API_URL` as an environment variable with the Render API origin, for example `https://veya-api.onrender.com`, then deploy.
4. If Vercel assigned a different frontend origin than the value entered in Render, update Render's `FRONTEND_URL` to that exact origin and redeploy/restart the API. If you add a Vercel preview or custom domain, add its origin to the API CORS configuration before using it.
5. In MongoDB Atlas, allow the API host to connect and use a dedicated database user with a strong password. Do not use the local development connection string in production.

The included Render Blueprint uses `COOKIE_SAME_SITE=none` because the default Vercel and Render hostnames are on different sites; this requires HTTPS, which both platforms provide. Browsers may restrict cross-site cookies. For the most reliable sign-in, use custom domains on the same parent site (for example, `chat.example.com` on Vercel and `api.example.com` on Render), then set Render's `FRONTEND_URL` to the custom frontend origin and `COOKIE_SAME_SITE=strict`.

Render must allow WebSocket connections for live messages. The app uses the Render-provided `PORT`; no port needs to be hardcoded in production.

## Included features

- Register, sign in, restore a session, and sign out
- Search for people and start one-to-one conversations
- Persisted, paginated conversation history and 5,000-character messages
- Real-time message delivery to authenticated conversation participants
- Responsive chat interface with black, white, soft red, and gold accents
