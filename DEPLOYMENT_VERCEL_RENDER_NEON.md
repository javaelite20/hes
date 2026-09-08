# SmartMonitoring — Deployment Guide
## Stack: Vercel (Frontend) + Render (Backend) + Neon (PostgreSQL)

This is the simplest production setup for MVP — all three platforms have generous free tiers and require no infrastructure management.

```
Browser
  │
  ▼
Vercel (React frontend)
  │
  │ HTTPS API calls
  ▼
Render (Spring Boot backend)
  │
  │ JDBC over SSL
  ▼
Neon (PostgreSQL)
```

---

## Cost (Free Tier)

| Service | Free Tier |
|---|---|
| Vercel | Unlimited personal projects, 100GB bandwidth/month |
| Render | 750 hours/month free web service (spins down after 15 min inactivity) |
| Neon | 0.5GB storage, 1 project, shared compute |

> **Note on Render free tier:** The backend spins down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds to wake up. For production use, upgrade to Render's paid plan (~$7/month) to avoid this.

---

## Phase 1 — Neon Database Setup

### Step 1.1 — Create Neon Account

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub login works)
2. Click **New Project**
3. Fill in:
   - Project name: `smartmonitoring`
   - Database name: `smart_monitoring`
   - Region: **AWS ap-south-1 (Mumbai)** — closest to India
4. Click **Create project**

### Step 1.2 — Get Connection String

After project creation, Neon shows you the connection string. Click **Connection details**.

Select **Connection string** format. It looks like:
```
postgresql://username:password@ep-xxx-yyy.ap-south-1.aws.neon.tech/smart_monitoring?sslmode=require
```

**Important:** Copy this exactly — you'll need it for Render.

For Spring Boot (JDBC format), change `postgresql://` to `jdbc:postgresql://`:
```
jdbc:postgresql://ep-xxx-yyy.ap-south-1.aws.neon.tech/smart_monitoring?sslmode=require
```

### Step 1.3 — Verify Connection (optional)

Test from your terminal:
```bash
psql "postgresql://username:password@ep-xxx.ap-south-1.aws.neon.tech/smart_monitoring?sslmode=require"
```

If you see the `smart_monitoring=#` prompt, it's working.

> **Note:** Liquibase will create all tables automatically on first Spring Boot startup. You don't need to run any SQL manually.

---

## Phase 2 — Render Backend Deployment

### Step 2.1 — Create Render Account

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Authorise Render to access your GitHub repos

### Step 2.2 — Create a New Web Service

1. Dashboard → **New** → **Web Service**
2. Connect your GitHub repo: `javaelite20/hes`
3. Fill in:

   | Field | Value |
   |---|---|
   | Name | `smartmonitoring-backend` |
   | Region | Singapore (closest free tier region to India) |
   | Branch | `main` |
   | Runtime | **Docker** |
   | Dockerfile path | `./Dockerfile` |
   | Instance type | Free (or Starter $7/month for always-on) |

4. Click **Advanced** to add environment variables (next step)

### Step 2.3 — Set Environment Variables on Render

In the **Environment** section, add these key-value pairs:

| Key | Value |
|---|---|
| `DATABASE_URL` | `jdbc:postgresql://ep-xxx.ap-south-1.aws.neon.tech/smart_monitoring?sslmode=require` |
| `DB_USERNAME` | your Neon username (from connection string) |
| `DB_PASSWORD` | your Neon password (from connection string) |
| `JWT_SECRET` | generate one: `openssl rand -base64 32` |
| `DCU_INTEGRATION_MODE` | `REST` |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` (fill in after Vercel deploy) |

> **Tip:** Leave `CORS_ALLOWED_ORIGINS` as `*` initially, then update it once you have the Vercel URL.

### Step 2.4 — Deploy

Click **Create Web Service**. Render will:
1. Pull your code from GitHub
2. Build the Docker image using your `Dockerfile`
3. Start the container
4. Run health checks on `/actuator/health`

First deploy takes 3-5 minutes. Watch the logs in the Render dashboard.

You'll see Liquibase running and creating all tables:
```
Liquibase: Running Changeset: 001-create-users-table
Liquibase: Running Changeset: 002-create-meters-table
...
Started SmartMonitoringApplication in 8.3 seconds
```

### Step 2.5 — Note your Render URL

After deployment, Render gives you a URL like:
```
https://smartmonitoring-backend.onrender.com
```

Test it:
```bash
curl https://smartmonitoring-backend.onrender.com/actuator/health
# Expected: {"status":"UP"}
```

### Step 2.6 — Seed Admin User

Use Neon's SQL editor to insert the admin user.

Go to **Neon Console → SQL Editor** and run:
```sql
INSERT INTO users (user_id, email, password, name, role, tower_number, flat_number, created_at, updated_at)
VALUES (
  'admin@society.com',
  'admin@society.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhe2',
  'Society Admin',
  'ADMIN',
  NULL,
  'OFFICE',
  NOW(), NOW()
);
```

Password for this hash is `admin123`. Change it after first login by updating the hash.

---

## Phase 3 — Vercel Frontend Deployment

### Step 3.1 — Create Vercel Account

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Authorise Vercel to access your GitHub repos

### Step 3.2 — Import Project

1. Dashboard → **Add New** → **Project**
2. Import your GitHub repo: `javaelite20/hes`
3. Vercel will detect it as a Vite project

### Step 3.3 — Configure Build Settings

Vercel needs to know the frontend is in a subfolder:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Root directory | `smart-monitoring-ui` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

### Step 3.4 — Set Environment Variable

Under **Environment Variables**:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://smartmonitoring-backend.onrender.com` |

This tells the React app where to send API calls.

### Step 3.5 — Deploy

Click **Deploy**. Vercel builds and deploys in ~1-2 minutes.

Your frontend URL will be:
```
https://hes-nine.vercel.app
```
or a custom domain you configure.

### Step 3.6 — Update CORS on Render

Now that you have the Vercel URL, go back to Render → your service → **Environment**:

Update:
```
CORS_ALLOWED_ORIGINS = https://hes-nine.vercel.app
```

Click **Save Changes** — Render will automatically redeploy with the new value.

---

## Phase 4 — Verify End to End

### Test login via curl

```bash
curl -X POST https://smartmonitoring-backend.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"admin@society.com","password":"admin123"}'
```

Expected response:
```json
{
  "userId": 1,
  "token": "eyJ...",
  "loginId": "admin@society.com",
  "name": "Society Admin",
  "role": "ADMIN",
  "towerNumber": null,
  "flatNumber": "OFFICE"
}
```

### Test full flow via UI

1. Open `https://hes-nine.vercel.app`
2. Sign in: `admin@society.com` / `admin123`
3. You should see the Admin Dashboard

---

## Phase 5 — Automatic Deployments (CI/CD)

Once everything is connected, deployments are automatic:

**Backend (Render):**
Every push to `main` → Render detects the change → rebuilds Docker image → redeploys automatically. No GitHub Actions needed for Render — it has built-in auto-deploy from GitHub.

Go to Render → your service → **Settings** → **Auto-Deploy**: make sure it's set to **Yes**.

**Frontend (Vercel):**
Every push to `main` → Vercel detects changes in `smart-monitoring-ui/` → rebuilds and redeploys automatically. Also built-in, no GitHub Actions needed.

> This means you can **remove or ignore** the `.github/workflows/` files for this deployment stack. They were written for the AWS/ECS setup.

---

## Environment Variables Summary

### Render (Backend)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Neon JDBC connection string | `jdbc:postgresql://ep-xxx.neon.tech/smart_monitoring?sslmode=require` |
| `DB_USERNAME` | Neon DB username | `saurabhkumar` |
| `DB_PASSWORD` | Neon DB password | `xxxxxxxxxxxx` |
| `JWT_SECRET` | Base64 JWT signing key | `aGVsbG8gd29ybGQ=...` |
| `DCU_INTEGRATION_MODE` | `REST` or `MQTT` | `REST` |
| `CORS_ALLOWED_ORIGINS` | Vercel frontend URL | `https://hes-nine.vercel.app` |
| `RETENTION_RAW_READINGS_DAYS` | Optional, default 90 | `90` |
| `RETENTION_DAILY_CONSUMPTION_DAYS` | Optional, default 1095 | `1095` |

### Vercel (Frontend)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Render backend URL | `https://smartmonitoring-backend.onrender.com` |

---

## Troubleshooting

**Render deploy fails — Dockerfile not found**
- Make sure `Dockerfile` is at the repo root (not inside `smart-monitoring-ui/`)
- Check Render's Dockerfile path is set to `./Dockerfile`

**Liquibase fails on startup — SSL error**
- Ensure `DATABASE_URL` contains `?sslmode=require` at the end
- Neon requires SSL — without it the connection is rejected

**CORS error in browser**
- Check `CORS_ALLOWED_ORIGINS` on Render matches your Vercel URL exactly (no trailing slash)
- After updating env vars on Render, wait for redeploy to complete

**Backend returns 502 after inactivity (free tier)**
- This is Render's free tier spin-down behaviour
- First request after 15 min inactivity takes ~30 seconds
- Upgrade to Render Starter ($7/month) to keep it always-on

**Neon connection pool exhausted**
- Neon free tier allows max 10 connections
- `maximum-pool-size` is set to 5 in config — this should be fine
- If you see connection errors, check Neon dashboard for active connections

**Vercel shows blank page or 404 on refresh**
- Add a `vercel.json` at the root of `smart-monitoring-ui/` (see below)

If React Router routes return 404 on direct URL access, add this file:

```json
// smart-monitoring-ui/vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Quick Reference — All URLs

| Service | URL |
|---|---|
| Frontend | `https://hes-nine.vercel.app` |
| Backend | `https://smartmonitoring-backend.onrender.com` |
| Health check | `https://smartmonitoring-backend.onrender.com/actuator/health` |
| Neon console | `https://console.neon.tech` |
| Render dashboard | `https://dashboard.render.com` |
| Vercel dashboard | `https://vercel.com/dashboard` |
