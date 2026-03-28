# 🎓 Stonepark Chromebook Borrowing System

A full-stack web application for Stonepark Intermediate School to manage the borrowing and reservation of Chromebooks, including charging cabinets and individual devices.

## Repository

- GitHub: https://github.com/Charlie0113-T/Stonepark-Chromebooks-Borrowing-System.git
- Live frontend: https://stonepark-chromebook-manager.vercel.app

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📋 **Resource Dashboard** | Grid view of all Chromebook resources with live status |
| 🟢🟡🔴 **Status Colours** | Green = Available, Yellow = Partial, Red = Full |
| 📅 **Bookings** | Time-slot reservations with borrower/class record |
| 📑 **All Bookings Tab** | Tab showing all bookings across all resources |
| 🚫 **Conflict Detection** | Automatic time-overlap checks; prevents double-booking |
| ⏰ **Overdue Detection** | Automatic detection of overdue bookings |
| 🔍 **Search & Filters** | Search resources/bookings by name, room, class; filter by type/status |
| ➕ **Add Resource** | Add new resources directly from the dashboard UI |
| 🗂 **Resource Management** | Update and delete resources via API |
| 📊 **Statistics** | Utilisation charts, pie chart, per-resource table, overdue count |
| ↩️ **Return / Cancel** | Mark active bookings as returned or cancelled |
| 🔄 **Auto-refresh** | Dashboard refreshes every 30 seconds |
| 📱 **Responsive** | Works on Chromebook, tablet, and desktop |
| 💾 **SQLite Persistence** | All data persists across restarts via SQLite (PostgreSQL-ready) |
| 🔐 **Authentication** | JWT + Google OAuth 2.0 (Workspace) sign-in; sign-out button in header |
| 📧 **Email Notifications** | Nodemailer sends booking-created / returned emails (configurable via .env) |
| 💬 **Google Chat Webhook** | Posts booking events to a Google Chat space (configurable via .env) |
| 📲 **PWA / Offline** | Service worker caches app shell + recent API responses for offline use |
| 🏫 **Multi-school / Campus** | Resources are scoped to a school; campus selector filters the dashboard |
| 📅 **Calendar View** | Monthly / weekly / daily calendar of all bookings (react-big-calendar) |
| 📷 **QR Code** | Every booking has a QR code for fast check-in / check-out scanning |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, TailwindCSS 3, Recharts, Axios, react-big-calendar, qrcode.react |
| **Backend** | Node.js, Express 5 |
| **Database** | SQLite via `better-sqlite3` in local development; production-ready PostgreSQL deployment supported via `render.yaml` |
| **Auth** | JWT (`jsonwebtoken`) + `passport-google-oauth20` |
| **Notifications** | Nodemailer (SMTP) + Google Chat incoming webhook |
| **PWA** | Custom service worker with cache-first (static) + network-first (API) strategy |

---

## 📁 Project Structure

```
├── backend/
│   ├── index.js               # Express server entry point
│   ├── .env.example           # Copy to .env and fill in your secrets
│   └── src/
│       ├── db/
│       │   └── database.js    # SQLite setup, schema migrations, seed data
│       ├── middleware/
│       │   └── auth.js        # JWT verification & optional bypass (AUTH_BYPASS=true)
│       ├── models/
│       │   └── booking.js     # Conflict detection & overdue logic
│       ├── routes/
│       │   ├── auth.js        # POST /api/auth/login, GET /api/auth/google, GET /api/auth/me
│       │   ├── resources.js   # GET/POST/PUT/DELETE /api/resources
│       │   ├── bookings.js    # GET/POST/PATCH /api/bookings + QR endpoint
│       │   ├── schools.js     # GET/POST /api/schools
│       │   └── stats.js       # GET /api/stats
│       └── services/
│           └── notifications.js # Nodemailer + Google Chat webhook
└── frontend/
    ├── public/
    │   ├── manifest.json          # PWA manifest
    │   └── sw.js                  # Custom service worker
    └── src/
        ├── api/index.ts           # Axios API client (auth token injected automatically)
        ├── types/index.ts         # TypeScript interfaces
        ├── serviceWorkerRegistration.ts  # SW registration helper
        ├── components/
        │   ├── CalendarView.tsx   # react-big-calendar booking calendar (month/week/day)
        │   ├── LoginForm.tsx      # Email + Google OAuth login modal
        │   ├── QRCodeModal.tsx    # SVG QR code for check-in / check-out
        │   ├── ResourceCard.tsx   # Resource status card
        │   ├── BookingForm.tsx    # New booking form
        │   ├── BookingList.tsx    # Booking history per resource (with QR button)
        │   ├── AllBookings.tsx    # All bookings list (with QR button)
        │   ├── AddResourceForm.tsx
        │   ├── StatsView.tsx      # Charts & statistics
        │   ├── StatusBadge.tsx
        │   └── Modal.tsx
        └── App.tsx                # Main app – tabs, school selector, auth header
```

## Deployment

### Frontend on Vercel

- `vercel.json` is configured for a React single-page app.
- Build command: `npm run build --prefix frontend`
- Output directory: `frontend/build`

### Backend on Render

- `render.yaml` defines a Node API service and PostgreSQL database.
- Configure environment variables in the Render dashboard after import.
- Set `AUTH_BYPASS=false` in production.
- Set `CORS_ORIGIN` and `FRONTEND_URL` to your deployed frontend URL.

## Notes

- The default local setup uses SQLite for simplicity.
- Production deployment is intended to use PostgreSQL.
- Do not commit secrets such as `JWT_SECRET`, SMTP credentials, or OAuth client secrets.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # edit with your secrets
npm start              # production
# or
npm run dev            # development (nodemon hot-reload)
```

Server runs at **http://localhost:4000**

The SQLite database is created automatically at `backend/data/chromebook.db` on first run.
Seed data is inserted only if the database is empty.

### 2. Frontend

```bash
cd frontend
npm install
npm start          # development server at http://localhost:3000
# or
npm run build      # production build in /build
```

---

## ⚙️ Environment Variables (`.env`)

Copy `backend/.env.example` to `backend/.env` and configure the values for your environment:

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=4000

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH=./data/chromebook.db

# ── Authentication ────────────────────────────────────────────────────────────
JWT_SECRET=change-this-to-a-secure-random-string
AUTH_BYPASS=false                           # use true only for local development

# Google OAuth 2.0 (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000

# ── Email (Nodemailer) ────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFY_FROM=Chromebook Manager <your-email@gmail.com>
NOTIFY_TO=admin@stonepark.school.nz

# ── Google Chat Webhook ───────────────────────────────────────────────────────
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/.../messages?key=...
```

---

## 🔐 Authentication

The current repository is ready for deployment to GitHub, Vercel, and Render. For production, make sure you set all required secrets and disable auth bypass.

### Dev Mode
Set `AUTH_BYPASS=true` in `.env` only for local testing. All API endpoints are open — no token required.

### Email / Password
`POST /api/auth/login` with `{ "email": "...", "name": "..." }` returns a JWT.
The frontend stores it in `localStorage` and sends it as `Authorization: Bearer <token>`.

### Google OAuth 2.0 (Google Workspace)
1. Create an OAuth 2.0 client ID in [Google Cloud Console](https://console.cloud.google.com/).
2. Add `http://localhost:4000/api/auth/google/callback` as an authorised redirect URI.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `.env`.
4. Users click **Sign in with Google** → redirected to Google → token returned in the browser URL fragment.

### Admin & Whitelist (Recommended)

For deployment, configure these values in your host dashboard rather than committing them to the repository.

- Recommendation: Prefer Google OAuth for all seeded teachers/admins — this avoids sharing or managing passwords. If a teacher/admin has a Google Workspace account that matches a whitelisted email, they will be recognized on first Google sign-in and (if listed in `ADMIN_USERS`) granted admin role.
- Ensure the following environment variables on your deployment (Render or other host):

```
WHITELIST_SEED=comma,separated,list@school.edu
ADMIN_USERS=admin1@school.edu:TempP@ssw0rd,admin2@school.edu:TempP@ss!
```

- Best practice:
  - Add all teacher emails to `WHITELIST_SEED` (or insert them directly into the DB).
  - Add admin emails to `ADMIN_USERS` (email:password pairs). For security you can set placeholder/temporary passwords and require a change, or rely on Google OAuth and omit passwords in production.
  - After changing env vars on your host (Render), redeploy/restart the backend so seeds and auth config apply.

- Quick DB fallback (if you need to set admin directly):

```bash
# mark an existing user as admin (SQLite)
sqlite3 backend/data/chromebook.db "UPDATE users SET role='admin' WHERE email='sjvos@cloud.edu.pe.ca';"
```

Use the Google OAuth path whenever possible — it's simpler for users and reduces password support overhead.

---

## 📧 Notifications

### Email (Nodemailer)
Configure SMTP credentials in `.env`. Emails are sent:
- When a booking is **created** (to `NOTIFY_TO`)
- When a booking is **returned** (to `NOTIFY_TO`)

### Google Chat Webhook
Set `GOOGLE_CHAT_WEBHOOK_URL` in `.env` to a [Google Chat incoming webhook](https://developers.google.com/chat/how-tos/webhooks). The same events trigger a Chat message.

---

## 📲 PWA / Offline Support

The app registers a service worker (`public/sw.js`) automatically:

- **App shell** (HTML/CSS/JS) is cached on install → loads instantly offline.
- **API responses** (`/api/*`) use **network-first** with a cache fallback — the last known data is shown when offline.
- Install prompt appears on supporting browsers/ChromeOS.

---

## 🏫 Multi-School / Multi-Campus

- Resources are tagged with a `schoolId`.
- `GET /api/resources?schoolId=<id>` filters resources to one campus.
- `GET /api/schools` returns all registered schools/campuses.
- `POST /api/schools` creates a new school (`{ "name": "...", "campus": "..." }`).
- When multiple schools exist, a **campus selector** appears in the app header.

---

## 📅 Calendar View

The **📅 Calendar** tab shows all bookings in a monthly / weekly / daily calendar:

- Each booking is colour-coded: **active** (dark grey), **overdue** (red), **returned** (green), **cancelled** (grey/faded).
- Click any event to see borrower, resource, time slot, and booking ID.
- The calendar switches between Month / Week / Day views.

---

## 📷 QR Code Check-in / Check-out

Every booking has a **📲 QR** button that displays an SVG QR code containing:

```json
{
  "bookingId": "...",
  "resourceId": "...",
  "borrower": "...",
  "status": "active"
}
```

A scanner (e.g. a tablet at the resource location) reads the code and can `PATCH /api/bookings/:id/return` to check the device back in, or `PATCH /api/bookings/:id/cancel` to cancel.

---

## ✅ Before Publishing to GitHub

- Review `.env` files and keep secrets out of the repository.
- Confirm the repository remote is set to `https://github.com/Charlie0113-T/Stonepark-Chromebooks-Borrowing-System.git`.
- Verify the GitHub repository branch is `main`.
- After updating the README, commit and push your changes from your local Git client.

**API endpoint:**
```
GET /api/bookings/:id/qr          → PNG image (default)
GET /api/bookings/:id/qr?format=svg → SVG image
```

---

## 🗄 Switching to PostgreSQL

The database layer is isolated in `backend/src/db/database.js`. To switch from SQLite to PostgreSQL:

1. Install the `pg` driver: `npm install pg`
2. Update `database.js` to use `pg.Pool` with `DATABASE_URL` from `.env`.
3. Translate the `better-sqlite3` synchronous calls to `async/await` with `pool.query()`.
4. All business logic in `routes/` and `models/` stays unchanged.

---

## 🔌 API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Email login → returns JWT |
| `GET` | `/api/auth/google` | Redirect to Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback → redirects to frontend with `?token=` |
| `GET` | `/api/auth/me` | Returns current user (requires JWT) |
| `GET` | `/api/auth/status` | Returns auth config (bypass enabled, Google configured, etc.) |

### Schools

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/schools` | List all schools/campuses |
| `POST` | `/api/schools` | Create a new school |

### Resources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/resources` | List all resources (supports `?schoolId=`) |
| `GET` | `/api/resources/:id` | Get single resource |
| `POST` | `/api/resources` | Create a new resource |
| `PUT` | `/api/resources/:id` | Update a resource |
| `DELETE` | `/api/resources/:id` | Delete a resource (blocked if active bookings) |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bookings` | List all bookings (supports `?resourceId=`, `?status=`, `?search=`, `?schoolId=`) |
| `GET` | `/api/bookings/:id` | Get single booking |
| `GET` | `/api/bookings/:id/qr` | QR code PNG (add `?format=svg` for SVG) |
| `POST` | `/api/bookings` | Create booking (with conflict detection) |
| `PATCH` | `/api/bookings/:id/return` | Mark booking as returned |
| `PATCH` | `/api/bookings/:id/cancel` | Cancel a booking |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Overall stats + per-resource utilisation (supports `?schoolId=`) |

---

## 📊 Data Models

### Resource

```typescript
{
  id: string;
  schoolId: string;      // e.g. "school-default"
  type: "cabinet" | "single";
  name: string;
  classRoom: string;
  totalQuantity: number;
  description: string;
  // Derived (API response only):
  currentBooked: number;
  availableNow: number;
  status: "available" | "partial" | "full";
  overdueBookings: number;
}
```

### Booking

```typescript
{
  id: string;
  resourceId: string;
  borrower: string;
  borrowerClass: string;
  quantity: number;
  startTime: string;           // ISO 8601
  endTime: string;             // ISO 8601
  actualReturnTime: string | null;
  status: "active" | "returned" | "cancelled";
  notes: string;
  isOverdue: boolean;          // derived
}
```

---

## 🎨 Colour System

| Status | Colour | Hex | Meaning |
|--------|--------|-----|---------|
| Available | 🟢 Green | `#28a745` | Resource is completely free |
| Partial | 🟡 Yellow | `#ffc107` | Some units are in use |
| Full | 🔴 Red | `#dc3545` | All units are booked |
| Overdue | 🔴 Red | `#dc3545` | Booking past its end time |

- **Border colour:** `#333333` (dark grey)
- **Background:** `#f8f9fa` (light grey)
- **Font:** Inter (sans-serif)

---

## 📝 License

Apache License 2.0
