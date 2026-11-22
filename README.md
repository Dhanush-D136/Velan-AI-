# Velan AI — Next-Gen GPS-Verified College Management Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-black.svg)](https://socket.io/)

> **Velan AI** is an enterprise-grade, production-ready College Management Platform featuring three role-based portals (**Admin**, **Faculty**, **Student**), high-accuracy **GPS-verified geofenced attendance**, an interactive **timetable builder with real-time conflict detection**, **hardware device lock** (one account per phone), **class-exclusive real-time chat**, **ExcelJS registers**, and a **collegiate AI assistant**.

---

## 🌟 Demo Logins (Pre-Seeded)

| Portal | Email | Password | Role & Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@velan.ai` | `Admin@123` | Full command center: Academic hierarchy, Timetable builder, Live GPS monitor, Device approvals, Excel reports |
| **Faculty Member** | `dr.ramesh@velan.ai` | `Faculty@123` | Professor & HOD: Start GPS sessions, adjust radius/duration, manual checklist fallback, class roster |
| **Enrolled Student** | `student.arun@velan.ai` | `Student@123` | CSE Year 2 Section A: Mark GPS attendance with radar animation, safe-bunk calculator, heatmap |

*Tip: The login page includes **one-click demo fill buttons** for instant evaluation without typing.*

---

## 🚀 Quick Start (Local Run with Zero Friction)

### 1. Prerequisites
- Node.js `v18+` or `v20+` (Tested on `v24`)
- npm `v9+` or `v10+`

### 2. Installation & Seed
```bash
# 1. Install root, shared, server, and client dependencies
npm install

# 2. Build shared contracts
npm run build --prefix shared

# 3. Seed 1 Super Admin, 3 Departments, 8 Faculty, 4 Classes, 120 Students, 30-Day Attendance
npm run seed --prefix server
```

### 3. Run the Platform
```bash
# Run backend server (Port 5000) and client portal (Port 5173) simultaneously:
npm run dev
```

Open your browser at: **`http://localhost:5173`**

---

## 🛰️ GPS Attendance & Geofence System

### How GPS Geofencing Works
1. **Faculty Anchor Capture:** When faculty clicks **"Start GPS Attendance"**, the browser requests geolocation (`navigator.geolocation`) with high-accuracy mode (< 30m accuracy threshold).
2. **Geofence Parameters:** Faculty adjusts the radius slider (presets: **50m, 100m, 250m, 500m**, default 500m) and session countdown (5, 10, 15 minutes).
3. **Targeted Broadcast:** Socket.IO pushes a targeted alert **strictly to students enrolled in that specific class** for that subject.
4. **Student Verification (Server-Side):**
   - Haversine distance formula: $d = 2R \arcsin\left(\sqrt{\sin^2(\Delta\phi/2) + \cos\phi_1\cos\phi_2\sin^2(\Delta\lambda/2)}\right)$
   - Verifies student coordinates $\le \text{radius} + \text{accuracy allowance}$.
   - Hardware device ID match check (prevents friend marking for friend).
   - Anti-spoofing flags check (mock provider, teleport jump speeds $> 45\text{ m/s}$, synthetic 0-accuracy detection).
5. **Real-Time Live Board:** Faculty and Admin screens update live via Socket.IO with avatar chips flipping green and interactive pins on Leaflet OpenStreetMap.
6. **Manual Fallback:** Quick swipe/tap checklist with `PRESENT`, `ABSENT`, `LATE`, `ON_DUTY` tags and audit logs.

### 🧪 Laptop Testing Mode (Demo Position Simulator)
In the student **"Mark Attendance"** screen, an interactive **Demo Mode GPS Simulator** slider allows testing both states right from your laptop:
- **Preset: In Classroom (65m)** $\rightarrow$ Instant **Verified Present** checkmark with confetti animation.
- **Preset: Campus Canteen (240m)** $\rightarrow$ Verified inside 500m geofence.
- **Preset: Hostel / Outside (820m)** $\rightarrow$ **Boundary Exceeded** rejection with exact distance feedback.

---

## 🔒 Device Lock (One-Phone-One-Account)

To prevent proxy attendance and exam cheating:
- On first login, the user's browser/phone generates a unique persistent device ID stored in `IndexedDB` and cookie.
- Every login and attendance mark verifies against `UserDevice`.
- Login from an unauthorized phone triggers the **"This account is linked to another device"** challenge.
- The user can tap **"Request Device Change"** with a reason.
- Admin reviews requests in **Admin $\rightarrow$ Device Requests** with 1-click **Approve & Rebind** or **Reject** (with audit log entries).

---

## 🗓️ Timetable Builder with Live Conflict Detection

- **Weekly Grid:** Monday to Saturday, Periods 1 to 7 with break/lunch dividers.
- **Live Conflict Detection Engine:**
  - **Faculty Double-Booking:** Blocks assigning a teacher who is already booked in another class in that period.
  - **Room Occupancy Clash:** Detects and prevents room collision across departments.
  - **Multi-Period Lab Blocks:** Supports consecutive lab slots.
  - **Heuristic Auto-Generate Solver:** One-click algorithm fills schedule satisfying all workload constraints.
  - **Print / PDF:** Direct formatted print output.

---

## 📊 ExcelJS Import & Export Engine

- **Classic Monthly Attendance Register:**
  - Students as rows, calendar dates as columns.
  - Color-coded cells (`P` green, `A` red, `L` yellow, `OD` blue).
  - Frozen headers (Student names remain visible on horizontal scroll).
  - Auto-calculated summary formulas (`Total Present`, `Total Absent`, `Percentage`).
- **Reports:** Subject-wise breakdown, shortage list below 75%, and GPS-vs-Manual ratio.

---

## 🌐 Production Deployment Guide

### Architecture: Supabase + Render + Vercel

```
[Vercel: React Frontend] ──── REST / Socket.IO ────> [Render: Node.js Express Web Service]
                                                               │
                                                               ├──> [Supabase Postgres (Prisma ORM)]
                                                               └──> [Supabase Storage (PDFs/Images)]
```

### 1. Supabase (Database & Storage)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings $\rightarrow$ Database** and copy:
   - Pooled connection string (Port 6543, `pgbouncer=true`) $\rightarrow$ `DATABASE_URL`
   - Direct connection string (Port 5432) $\rightarrow$ `DIRECT_URL`
3. Create Supabase Storage buckets: `photos`, `materials`, `submissions`.

### 2. Render (Backend Web Service)
1. Link your Git repository in [render.com](https://render.com).
2. Choose **Web Service** using `render.yaml` or manual configuration:
   - **Root Directory:** `server`
   - **Build Command:** `npm ci && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && node dist/index.js`
   - **Health Check Path:** `/health`
3. Set Environment Variables:
   - `DATABASE_URL`: Your Supabase pooled string
   - `DIRECT_URL`: Your Supabase direct string
   - `JWT_SECRET`: Random 64-char key
   - `JWT_REFRESH_SECRET`: Random 64-char key
   - `CLIENT_ORIGIN`: Your deployed Vercel frontend URL

### 3. Vercel (Frontend Client)
1. Import repository in [vercel.com](https://vercel.com).
2. Set **Root Directory** to `client`.
3. Framework Preset: **Vite**.
4. Set Environment Variables:
   - `VITE_API_URL`: Your Render backend URL (e.g. `https://velan-server.onrender.com/api`)
   - `VITE_SOCKET_URL`: Your Render backend base URL
5. Deploy. `vercel.json` already contains the SPA rewrite to `index.html`.

---

## 🧪 Automated Test Suite

Run the full unit and integration test suite:
```bash
npm run test --prefix server
```
Test coverage includes:
- Haversine distance mathematical correctness
- Geofence radius boundary enforcement
- Anti-spoofing heuristics (synthetic accuracy, impossible teleport jumps)
- Render `/health` monitoring endpoint
- Password hashing & JWT RBAC authentication

---

## 🛡️ License & Copyright
Developed for **Velan Engineering College**. All rights reserved.
Built with Apple, Linear, and Stripe design principles.
