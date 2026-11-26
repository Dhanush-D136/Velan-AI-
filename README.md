# Velan AI — Enterprise GPS Attendance & Campus Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748.svg)](https://www.prisma.io/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6.1-blue.svg)](https://capacitorjs.com/)

> **Velan AI** is a universal, production-grade College Management Platform featuring three role-based portals (**Admin**, **Faculty**, **Student**), high-precision **GPS-verified geofenced attendance**, **academic hierarchy management** (Department → Year → Class → Faculty & Students), **Excel roster bulk onboarding**, **hardware device locks** (one account per phone), **timetable conflict detection**, **real-time chat**, and an **interactive AI assistant**.

---

## 🏛️ Universal Multi-Tenant Architecture

Velan AI is built for universal collegiate deployment:
- **No hardcoded institution names:** Clean white interface with engineering dot grid backgrounds.
- **Dynamic Branding:** The institution name is an optional setting in **Admin Settings**, blank by default, and appears across dashboards and reports only when set by the institution administrator.
- **Three Dedicated Portals:**
  - **Admin Portal:** Desktop-first command center with wide data tables, Excel import/export, user provisioning, and authorization queues.
  - **Faculty Portal:** Mobile-first dashboard for period tracking, starting GPS attendance geofences, and manual audit overrides.
  - **Student Portal:** Attendance tracking, GPS attendance check-in, timetable, and locked profile management.

---

### 1. Prerequisites
- Node.js `v18+` or `v20+`
- npm `v9+` or `v10+`

### 2. Environment Configuration
Create `.env` inside the `server/` directory:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://..."
JWT_SECRET="your-ultra-secure-jwt-secret-key-32chars"
ADMIN_USERNAME="Vel"
ADMIN_PASSWORD="your-secure-admin-password"
CLIENT_ORIGIN="http://localhost:5173"
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_EMAIL="mailto:admin@velan.ai"
```

To generate Web Push VAPID keys, run:
```bash
npx web-push generate-vapid-keys
```
Copy the printed Public and Private keys into `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

> **Mobile GPS & Web Push HTTPS Note:** Browsers require a secure **HTTPS** origin (or `localhost` during local testing) for Geolocation API and Service Worker Web Push subscriptions. On iOS Safari, users must tap **Share → Add to Home Screen** before enabling Web Push.

### 3. Installation & Database Setup (Windows PowerShell)
```powershell
# Install root, shared, server, and client dependencies
npm install

# Build shared contracts
npm run build --prefix shared

# Initialize database schema and generate Prisma client
npx prisma db push --schema=server/prisma/schema.prisma

# Seed initial Super Admin account and universal default settings
npm run seed --prefix server
```

### 4. Run & Test the Platform
```powershell
# Start backend API (Port 5000) and frontend SPA (Port 5173) concurrently:
npm run dev

# Run backend test suite & client production build
npm test; npm run build:client
```

### 5. Phase 3 Admin Configuration (Semester Dates, Holidays & Grading Scale)
- **Semester Dates & Holidays:** Navigate to **Admin → Academics & Grading → Semester & Holidays** to configure the active semester window (`startDate` / `endDate`), institutional holidays, and required/condonation attendance thresholds (`75%` / `65%` by default). These power the student **"Can I Skip?"** calculator and semester-end projections.
- **Grading Scale & Credit Lookup:** Navigate to **Admin → Academics & Grading → Grading & Credits** to customize Regulation `2021` grade points (`O=10, A+=9, A=8, B+=7, B=6, C=5`, `RA/WH/WD/AB=0`), CGPA-to-percentage multiplier, and fallback subject credit mappings.

### 6. Phase 4: Admin Live Monitor, Server Health & Uptime Monitoring
- **Presence & Sessions:** Tracks real-time online/idle users (30s Page Visibility heartbeat, 5m idle detection, 20s disconnect grace period), unique logged-in today vs. never-logged-in users, and suspicious activity flags.
- **Health Thresholds:**
  - **Healthy:** Event-loop lag p99 `< 100ms`, HTTP p95 `< 500ms`, 5xx `< 1%`, memory `< 75%`, CPU `< 70%`.
  - **Degraded:** Any threshold exceeded for 2 minutes.
  - **Struggling:** Lag p99 `> 300ms`, HTTP p95 `> 2s`, 5xx `> 5%`, memory `> 90%`, or CPU `> 90%` sustained for 1 minute.
- **External Uptime Monitor:** Point UptimeRobot (or any external monitor) at **`GET /api/health`** (public, minimal `ok + uptime`). A server cannot report its own total outage, so external pinging is recommended for downtime alerts.
- **Scaling Guide:** Use PostgreSQL/Supabase for multi-hundred/thousand-student concurrency, terminate TLS behind Nginx/Vercel/Render, and add a Redis Socket.IO adapter if scaling horizontally across multiple Node instances.
- **Privacy & Retention:** IP addresses and device metadata are used solely for security and attendance audit, visible to users in Settings, and purged automatically after 90 days (30 days for minute-level server metrics).

### 7. Phase 5: Rush-Hour Check-In Queue (Default OFF)
- **Admin Settings → Rush-Hour Waiting Queue:** Off by default. When turned **ON**, bursts exceeding the trigger threshold (default `30` waiting or `30/sec`) are admitted with a FIFO ticket and saved in `250ms` database transactions (default `25/sec`).
- **Honesty & Fairness:** Deadlines are judged by server arrival time (`pressed_at`), invalid/out-of-range check-ins are rejected immediately, session close drains queued tickets before marking absentees, and students see a real countdown alongside **Thirukkural couplets with Tamil Porul**.
- **Load Test:** Run `npm run load-test` to simulate 300 concurrent student arrivals and measure admission throughput and p95 latency.

Open your browser at **`http://localhost:5173`**.

---

## 🔐 Authentication & Security Model

### Portal Access Identifiers
- **Admin:** Logs in with **Username** (`Vel` by default or configured `ADMIN_USERNAME`).
- **Faculty:** Logs in with **Employee ID** (e.g., `FAC001`).
- **Student:** Logs in with **Register Number** or **Roll Number** (e.g., `710024104001`).

### Default Password Policy
- Every newly registered faculty and student account receives initial default password **`1234`**.
- On first sign-in, the system forces a mandatory **Password Change**. Password complexity has no arbitrary restrictions—it can contain any normal characters, must not be empty, and cannot remain `1234`.

### Forgot Password Workflow
1. Users click **"Forgot password?"** on the login portal, enter their institutional identifier, and submit a request.
2. The request enters **Admin → Requests & Approvals**.
3. Upon Admin approval, the password resets to `1234`, and the user is required to change it on their next sign-in.
4. Administrators can never view cleartext passwords.

### One-Phone Hardware Device Lock
- Every account binds to the user's physical device identifier upon login.
- Sign-ins from unauthorized hardware are blocked and can submit a **Device Transfer Request** to the Admin queue with a stated justification.
- Prevents proxy GPS check-ins between students.

---

## 📋 Academic Hierarchy & Data Flows

### Administrative Onboarding Sequence
1. **Department:** Create departments with Code and Name (e.g., `CSE`, `Computer Science and Engineering`).
2. **Academic Year:** Add academic years under a department (e.g., Year 1, 2, 3, 4).
3. **Class / Section:** Create sections under an academic year (e.g., Section A, Section B).
4. **Subjects:** Add theoretical courses and laboratory subjects.
5. **Class-Subject-Teacher Assignments:** Assign faculty to teach subjects within specific classes. A teacher can handle multiple subjects across different sections.
6. **Faculty Directory:** Register teaching staff with Employee ID, Department, and Designation.
7. **Students Directory:**
   - **Manual Registration:** Add individual students with Roll Number, Register Number, and Class.
   - **Excel Bulk Import:** Upload `.xlsx` file containing `ROLL NUMBER`, `REGISTER NUMBER`, and `STUDENT NAME`. Includes downloadable template, pre-import validation preview, and skipped row reporting.

### Student Profile Completion & Permanent Lock
- After first sign-in, students complete remaining records: Personal Email, Phone, Date of Birth, Gender, Blood Group, Residential Address, Parent/Guardian Contact, and Photo.
- Upon saving, the profile **locks permanently** to protect institutional integrity.
- Corrections require submitting a **Profile Edit Request** to Admin. When approved, the profile unlocks for exactly one edit session and re-locks automatically.

---

## 🛰️ GPS Attendance Engine

1. **Faculty Anchor Session:** Faculty starts attendance for an active period, setting radius (50m to 500m) and expiration countdown.
2. **Real-Time Delivery:** Socket.IO pushes an attendance broadcast strictly to students enrolled in that class.
3. **Server-Side Verification:**
   - Calculates geodesic distance using the Haversine formula against the faculty's anchor point.
   - Rejects mock GPS coordinates, impossible teleportation speeds (> 45 m/s), and synthetic location flags.
   - Verifies hardware device fingerprint ID.
4. **Manual Override:** Faculty can manually mark `PRESENT`, `ABSENT`, `LATE`, or `ON_DUTY` with audit logging.

---

## 📱 Mobile App & Capacitor Build

The frontend is wrapped with Capacitor for native Android & iOS distribution.

### Build Android APK Locally
```bash
# Build production web bundle
npm run build --prefix client

# Sync web assets to Capacitor Android project
npx cap sync android --prefix client

# Build debug APK with Gradle
cd client/android && ./gradlew assembleDebug
```
The output APK is generated at `client/android/app/build/outputs/apk/debug/app-debug.apk`.

### Automated GitHub Actions CI/CD
A GitHub Actions workflow (`.github/workflows/build-apk.yml`) automatically builds the Vite client, synchronizes Capacitor, and compiles a debug APK on every push to `main` or via manual trigger (`workflow_dispatch`). The downloadable `.apk` is uploaded as an artifact.

---

## 🧪 Automated Test Suite

Run the comprehensive test suite verifying geofence calculations, live API endpoints, and end-to-end academic flows:
```bash
npm run test --prefix server
```
- **Geofence Accuracy:** Haversine formula verification, geofence radius boundary assertions, mock-location and zero-accuracy detection, impossible speed teleportation rejection.
- **Attendance Flow:** Health endpoint check, Super Admin authentication, password verification.
- **Academic Hierarchy E2E:** Live API creation of Department → Year → Class → Faculty → Student, list verification, and login verification.

---

## 📄 License
MIT License. Built with engineering precision for modern educational institutions.
