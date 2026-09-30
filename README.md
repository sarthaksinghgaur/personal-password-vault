# Personal Password Vault

A MERN password vault prototype with client-side AES-GCM encryption.

## Project layout

- `backend/` Express, Mongoose, authentication, and credential API
- `frontend/` React and Vite client

## Local setup

### Backend

```bash
cd backend
cp .env.example .env
```

Fill in `MONGO_URI` and replace `JWT_SECRET` with a long random value. Then install and start the API:

```bash
npm install
npm run dev
```

The API runs on `http://localhost:5001` by default.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The Vite development server proxies `/api` requests to the backend.

## Render deployment

For the Render Static Site, add this environment variable and redeploy:

```text
VITE_API_URL=https://personal-password-vault.onrender.com
```

For the Render Web Service, set this environment variable and redeploy the backend:

```text
FRONTEND_URL=https://personal-password-vault-1.onrender.com
```

The frontend variable is read at build time. The backend variable controls credentialed CORS and must exactly match the deployed frontend origin, with no trailing slash.

## Security notes

- The master password is used in the browser to derive the vault key and is never sent to the server.
- Do not commit `.env` files, database credentials, JWT secrets, `node_modules`, or build output.
- Rotate any database password that has previously been exposed.
- This is an educational prototype and requires a professional security review before production use.
