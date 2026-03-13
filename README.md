# 🎓 Stonepark Chromebook Borrowing System

A full-stack web application for Stonepark Secondary School to manage the borrowing and reservation of Chromebooks, including charging cabinets and individual devices.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📋 **Resource Dashboard** | Grid view of all Chromebook resources with live status |
| 🟢🟡🔴 **Status Colours** | Green = Available, Yellow = Partial, Red = Full |
| 📅 **Bookings** | Time-slot reservations with borrower/class record |
| 🚫 **Conflict Detection** | Automatic time-overlap checks; prevents double-booking |
| 🔍 **Filters** | Filter by resource type or status |
| 📊 **Statistics** | Utilisation charts, pie chart, and per-resource table |
| ↩️ **Return / Cancel** | Mark active bookings as returned or cancelled |
| 🔄 **Auto-refresh** | Dashboard refreshes every 30 seconds |
| 📱 **Responsive** | Works on Chromebook, tablet, and desktop |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, TailwindCSS 3, Recharts, Axios, react-datepicker |
| **Backend** | Node.js, Express 5 |
| **Storage** | In-memory store (seed data included) — easily swappable for a DB |

---

## 📁 Project Structure

```
EXPLORE/
├── backend/
│   ├── index.js              # Express server entry point
│   └── src/
│       ├── data/
│       │   └── store.js      # In-memory data store + seed data
│       ├── models/
│       │   └── booking.js    # Conflict detection & resource enrichment
│       └── routes/
│           ├── resources.js  # GET/POST /api/resources
│           ├── bookings.js   # GET/POST/PATCH /api/bookings
│           └── stats.js      # GET /api/stats
└── frontend/
    └── src/
        ├── api/index.ts          # Axios API client
        ├── types/index.ts        # TypeScript interfaces
        ├── components/
        │   ├── ResourceCard.tsx  # Resource status card
        │   ├── BookingForm.tsx   # New booking form
        │   ├── BookingList.tsx   # Booking history per resource
        │   ├── StatsView.tsx     # Charts & statistics
        │   ├── StatusBadge.tsx   # Status colour badge
        │   └── Modal.tsx         # Accessible modal dialog
        └── App.tsx               # Main app with routing & layout
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Backend

```bash
cd backend
npm install
npm start          # production
# or
npm run dev        # development (nodemon hot-reload)
```

Server runs at **http://localhost:4000**

### 2. Frontend

```bash
cd frontend
npm install
npm start          # development server at http://localhost:3000
# or
npm run build      # production build in /build
```

---

## 🔌 API Reference

### Resources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/resources` | List all resources with live status |
| `GET` | `/api/resources/:id` | Get single resource |
| `POST` | `/api/resources` | Create a new resource |

**POST /api/resources body:**
```json
{
  "type": "cabinet",
  "name": "Cabinet D",
  "classRoom": "Room 104",
  "totalQuantity": 25,
  "description": "Optional description"
}
```

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/bookings` | List all bookings (supports `?resourceId=` & `?status=`) |
| `GET` | `/api/bookings/:id` | Get single booking |
| `POST` | `/api/bookings` | Create booking (with conflict detection) |
| `PATCH` | `/api/bookings/:id/return` | Mark booking as returned |
| `PATCH` | `/api/bookings/:id/cancel` | Cancel a booking |

**POST /api/bookings body:**
```json
{
  "resourceId": "res-003",
  "borrower": "Ms. Johnson",
  "borrowerClass": "Class 10A",
  "quantity": 10,
  "startTime": "2024-09-01T09:00:00Z",
  "endTime": "2024-09-01T11:00:00Z",
  "notes": "Science project"
}
```

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stats` | Overall stats + per-resource utilisation |

---

## 📊 Data Models

### Resource

```typescript
{
  id: string;           // e.g. "res-001"
  type: "cabinet" | "single";
  name: string;         // e.g. "Cabinet A"
  classRoom: string;    // e.g. "Room 101"
  totalQuantity: number;
  description: string;
  // Derived (API response only):
  currentBooked: number;
  availableNow: number;
  status: "available" | "partial" | "full";
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
  startTime: string;        // ISO 8601
  endTime: string;          // ISO 8601
  actualReturnTime: string | null;
  status: "active" | "returned" | "cancelled";
  notes: string;
}
```

---

## 🎨 Colour System

| Status | Colour | Hex | Meaning |
|--------|--------|-----|---------|
| Available | 🟢 Green | `#28a745` | Resource is completely free |
| Partial | 🟡 Yellow | `#ffc107` | Some units are in use |
| Full | 🔴 Red | `#dc3545` | All units are booked |

- **Border colour:** `#333333` (dark grey)
- **Background:** `#f8f9fa` (light grey)
- **Font:** Inter (sans-serif)

---

## 🔮 Future Enhancements

- [ ] Persistent database (PostgreSQL / Firebase Firestore)
- [ ] User authentication (Google Workspace / OAuth)
- [ ] Email / Google Chat notifications (Nodemailer / webhooks)
- [ ] PWA support (offline caching)
- [ ] Multi-school / multi-campus support
- [ ] Calendar view for bookings
- [ ] QR code check-in/check-out
- [ ] Admin panel for resource management

---

## 📝 License

MIT — Stonepark Secondary School
