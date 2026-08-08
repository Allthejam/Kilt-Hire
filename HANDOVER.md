# 🏴󠁧󠁢󠁳󠁣󠁴󠁿 Highland Kilt Hire — Back Office QR Portal
## Project Handover Document
> Paste this into a new conversation to continue where you left off.

---

## Project Location

| Item | Value |
|---|---|
| **Local project path** | `C:\Users\Allan\OneDrive\000 - New Business (AJ)\antigravity\Kilt Hire` |
| **GitHub repo** | `https://github.com/Allthejam/Kilt-Hire.git` (branch: `main`) |
| **Local dev URL** | `http://localhost:3005` |
| **Start dev server** | `npx next dev -p 3005` (run from project folder) |
| **Firebase project** | `kilt-hire` |
| **Firebase console** | `https://console.firebase.google.com/project/kilt-hire` |
| **Live deployment** | Firebase App Hosting (auto-deploys from GitHub `main` push) |

---

## Tech Stack

- **Framework**: Next.js 14.2.35 (App Router, `'use client'` single-page app)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **QR Scanning**: `@zxing/browser` + `@zxing/library` (`BrowserMultiFormatReader` — ZXing-based, handles mobile, angles, fabric distortion)
- **QR Generation**: Custom SVG renderer (no external lib)
- **Backend**: Firebase Auth + Firestore (live mode)
- **Deployment**: Firebase App Hosting (via `apphosting.yaml`)

---

## Firebase Configuration (`.env.local`)

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA_Z02DBMrHrTkRyWa7RU51-DZUAT30yxk
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kilt-hire.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kilt-hire
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kilt-hire.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=19791842628
NEXT_PUBLIC_FIREBASE_APP_ID=1:19791842628:web:0bd9c76967ee015d3e9b11
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-T0QQDMDLNZ
```

> These are NEXT_PUBLIC_ client-side keys — safe to have in .env.local. Also duplicated in apphosting.yaml for Firebase App Hosting builds.

---

## Key Source Files

| File | Purpose |
|---|---|
| `src/app/page.tsx` | **Entire app** — monolithic single-page component (~7000 lines) |
| `src/app/types.ts` | All TypeScript types (KiltItem, PurchaseOrder, StaffUser, etc.) |
| `src/app/mock-data.ts` | Seed data used to pre-populate Firestore on first run |
| `src/lib/firebase.ts` | Firebase App/Auth/Firestore initialisation (client-side guard) |
| `src/lib/firestore.ts` | CRUD helper functions for all Firestore collections |
| `apphosting.yaml` | Firebase App Hosting config + public env vars for build |

---

## Architecture

- **Single-page app** — all views/tabs rendered in page.tsx based on state
- **Auth**: Firebase Auth (email + password) for login; separate 4-digit PIN for in-app overrides (reprints, admin unlocks)
- **Data**: Firestore is source of truth; localStorage is a cache/fallback for offline use
- **Firebase guard**: `typeof window !== 'undefined'` in firebase.ts — prevents SSR crash during Next.js static generation
- **QR codes** follow format: KILT-XXXX (adult kilts), KILT-KIDS-XXX (kids), JKT-XXXX (jackets), BIN-[item] (bulk bins), etc.

---

## Firestore Collections

| Collection | Contents |
|---|---|
| `users` | Staff profiles (name, email, role, pin, uid) |
| `invites` | Invite codes for staff registration |
| `items` | Inventory items (KiltItem) |
| `batches` | QR code batches |
| `purchase_orders` | Hire orders (POs) |
| `audit_logs` | Action log (last 500) |
| `settings/pricing` | Category pricing matrix |

---

## User Roles

| Role | Access |
|---|---|
| `Master Admin` | Full access, can create invites, see all data, reset mock data |
| `Admin` | Most management features |
| `Shop Assistant` | Scanner only + basic PO management |

---

## Master Admin Account

- **Email**: `admin@kilt-hire.co.uk`
- **Role**: Master Admin
- Created via "Create Real Master Admin Account" button in sidebar
- Stored in Firebase Auth + Firestore /users/{uid}

---

## What Has Been Built (Completed)

### Core App
- Full inventory management (add, edit, retire items)
- QR code batch generation and printing (PDF/print)
- Iron-on QR label printing system
- Hire Purchase Order (PO) creation and management
- Multi-item PO return checklist with QR scan verification
- Laundry tracking, Repair workshop tracking
- Audit log, Category pricing matrix
- Staff invite system, Analytics/reporting tab

### Scanner
- jsQR real-time camera scanner (Admin + Shop Assistant views)
- Square camera viewport with amber corner frame only (no text inside)
- Text labels moved outside the camera frame
- `attemptBoth` inversion mode for better real-world printed label scanning
- Unrecognised QR code shows red error banner with the scanned code
- Manual QR text entry fallback
- Auto-action on scan: opens PO builder (available), return checklist (on hire), register form (new), repair note (in repair)

### Firebase Backend
- Firebase Auth wired to login, register, master admin register
- Firestore CRUD for all collections
- onAuthStateChanged listener for session persistence
- Client-side only initialisation (SSR safe — typeof window guard)
- apphosting.yaml with env vars for Firebase App Hosting builds
- Staff registration requires invite code

### Live Production Cleanup
- Removed all demo scan pickers (hardcoded KILT-1001 etc.)
- Removed demo quick-login buttons and "Demo: 1234" PIN hint
- "Reset to Mock Data" button hidden — Master Admin only
- All demo labels replaced with live labels

---

## Known Issues / Outstanding Work

### Critical
- ~~**QR scanning on mobile may not work**~~ ✅ **RESOLVED** — switched from jsQR to ZXing (`@zxing/browser` `BrowserMultiFormatReader`). ZXing uses TRY_HARDER mode, auto-selects back camera on iOS/Android, and handles real-world printed labels (distortion, low contrast, fabric wrinkle) far better.

### In Progress / Next Steps
- Staff registration flow — needs end-to-end test with a real invite code and a second device
- Real inventory data — currently seeded with mock data; real garment data needs to be entered
- QR label printing — needs testing with a real iron-on label printer
- Firebase App Hosting deployment — apphosting.yaml added; needs confirmation deployment succeeded

### Nice to Have
- PO email/PDF export for customers
- Return due date reminders
- Multi-store / multi-location support

---

## Recent Git Commits

```
ab64053  feat: convert Historic PO Archive into condensed data table with column sorting, rows-per-page selector (10, 20, 50, 100, ALL), expandable detail drawers, and << < > >> pagination
1a9c50a  feat: add unsaved return inspection protection with browser beforeunload warning and in-app exit confirmation modal
b20692e  fix: render Historic PO Archive workspace with date range filters, customer search, and repeat customer profile history
bb654a7  feat: split Customer POs into Active POs vs Historic PO Archive with automatic return completion archiving and repeat customer search
5e564ec  feat: add Late Return & Security Deposit Retention Section in full-page return workspace with custom fee input, presets, and live ledger update
9e5d341  feat: convert Process Return Checklist into a full-page view with 1-tap manual item condition toggles and deposit ledger
e953140  feat: dynamically hide empty movement sections and replace Column 3 with 2-Day Pick & Pack Assembly Queue
78ba89e  feat: restore Start New Fitting & Order button at the primary position of the subheader status filter bar
3ca74c6  feat: add PWA support - installable web app, manifest.json, sw.js, PWA icons, iOS install modal & top install banner
be8993a  feat: switch QR scanner from jsQR to ZXing BrowserMultiFormatReader for better mobile scanning
9a33458  fix: guard Firebase to client-side only, add apphosting.yaml env vars for App Hosting build
6093181  feat: clean up scanner from test/demo mode to live production
383a599  feat: wire Firebase Auth + Firestore backend - real accounts, cloud data persistence
```

---

## How to Continue in a New Conversation

1. Paste this entire document at the start of the new conversation
2. Say: "Continue working on the Highland Kilt Hire Back Office QR Portal. Read the handover document above."
3. The project is at: `C:\Users\Allan\OneDrive\000 - New Business (AJ)\antigravity\Kilt Hire`
4. Start dev server: `npx next dev -p 3005`

---

## Important Notes for Next Session

- Do NOT confuse with the Community Hub app at:
  `C:\Users\Allan\OneDrive\000 - New Business (AJ)\APPS Backups\Community Hub (ALL)\Main Community Hub APP`
- Always run `Remove-Item -Recurse -Force .next` before `npm run build` if you get chunk/cache errors
- After `npm run build`, delete `.next` and restart dev — build output conflicts with dev mode
- Everything is in `src/app/page.tsx` (~7000 lines) — be careful with large edits
- Firebase is live mode — any data written goes to the real production database
