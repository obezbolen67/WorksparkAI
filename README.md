# Workspark AI — Frontend

Modern, fast, and thoughtfully-designed AI workspace. Speak, search, analyze, and build with a polished UX that feels delightful on web and mobile.

- Lightning‑fast React + Vite + TypeScript app
- Stable voice chat with queued TTS/STT, backoff handling, and solid in-modal errors
- Beautiful chat UI with tool blocks: Code analysis, Web search, Docs extract, Geolocation, Google Maps, Image viewer
- Seamless subscriptions (Stripe). Pro is $18/month — voice chat included
- Production‑ready deployment on Cloud Run + Artifact Registry
- Android APK packaging with Capacitor

---

## ✨ Highlights

- Voice chat that just works:
  - Reply isolation, audio queueing, small inter‑segment gaps, and safe playback unlock
  - Friendly error UX for 401/403/429/5xx with dismiss-to-close
- Tool blocks in chat:
  - Code & file analysis, web search, document extraction
  - Geolocation & beautiful Google Maps routes, Street View, and traffic
  - Image previewer and clean attachments
- Thoughtful UX details:
  - Minimal, focused surfaces, subtle animations, scroll-to-bottom affordances
  - Clean typography, responsive layout, mobile‑first polish
- Production minded:
  - Zero console noise, strong error states, clear z‑index layering
  - Cloud Run-ready Dockerfile and Cloud Build pipeline

---

## 🧱 Tech Stack

- React 19, TypeScript, Vite 6
- Styling: plain CSS with theme variables (light/dark)
- Maps: `@react-google-maps/api`
- Payments: `@stripe/stripe-js` + redirect to Checkout
- Packaging: Capacitor (Android)
- Deployment: Docker → Artifact Registry → Cloud Run

---

## 🚀 Quick start (local)

Requirements: Node 18+.

```bash
# 1) Install
npm install

# 2) Configure local env
# Create .env in WorksparkAI/ with the variables below (or use .env.example):
# VITE_API_URL=http://localhost:3001
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
# VITE_GOOGLE_MAPS_API_KEY=AIza...

# 3) Run dev server
npm run dev

# Open http://localhost:5173
```

---

## 🔐 Environment variables

The frontend uses Vite’s `VITE_*` variables at build time. Typical keys:

- `VITE_API_URL` — Base URL of the backend (e.g., https://your-api.example.com)
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (safe for client)
- `VITE_GOOGLE_MAPS_API_KEY` — Google Maps JavaScript API key (public; lock down via referrers)

Runtime fallback (optional): the app can also read a public config from your backend at `GET /api/config` to avoid rebuilds for key rotations. Only return public, non‑secret values there.

---

## 🧭 Features in depth

- Voice chat
  - Auto queueing and rate‑limit backoff
  - Natural pacing (micro‑gaps), reply boundary isolation
  - Solid, theme‑matched in‑modal errors; dismiss closes voice
- Geolocation & Google Maps
  - Directions with A/B markers, polylines, traffic, Street View toggle
  - Fullscreen map, map type cycling, and deep-link to Google Maps
- Files & code
  - Drag & drop attachments, rich previews, code highlighting
- Subscriptions
  - Stripe Checkout redirect; smooth post‑purchase overlay and messaging

---

## 🧪 Scripts

```bash
# Dev
npm run dev

# Type‑check + build
npm run build

# Preview production build
npm run preview

# Capacitor helpers (Android)
npm run cap:add:android
npm run cap:build
npm run cap:sync
npm run cap:open:android
```

---

## 📦 Android APK (Capacitor)

1) Build web assets
```bash
npm run build
```

2) Add/sync Android
```bash
npm run cap:add:android
npm run cap:sync
```

3) Open in Android Studio
```bash
npm run cap:open:android
```

4) Build → Build Bundle(s)/APK(s) → Build APK(s)

Android permissions are included (microphone, location, internet). On first use, users will be prompted for mic/geolocation.

Tips:
- For autoplay audio, ensure a user gesture unlocks audio (handled by VoiceChat UX).
- For Maps in a WebView, consider serving from your HTTPS domain to use HTTP referrer restrictions, or use native Maps if you need Android app restrictions.

---

## ☁️ Production on Cloud Run

This repo includes:
- `Dockerfile` — multi‑stage build (Node → Nginx), serves SPA on port 8080
- `nginx.conf` — SPA routing with caching for static assets
- `cloudbuild.yaml` — Cloud Build pipeline that:
  - Reads secrets from Secret Manager (no secrets in Git)
  - Writes `.env.production` for Vite at build time
  - Builds & pushes an image to Artifact Registry
  - Deploys to Cloud Run

Secrets to store (Secret Manager):
- `VITE_API_URL` (e.g., https://api.yourdomain.com)
- `GOOGLE_MAPS_API_KEY` (lock by HTTP referrer for web)
- `STRIPE_PUBLISHABLE_KEY`

Optional runtime config endpoint (backend): `GET /api/config` → `{ googleMapsApiKey, stripePublicKey }`.

---

## 🔒 Security notes

- Never expose server secrets in the frontend. Only publishable/public keys go to the browser.
- Google Maps key is public by design. Lock it down:
  - Web: restrict by HTTP referrers (your domains)
  - Android WebView: prefer serving from your HTTPS domain or use native Maps SDK for Android app restrictions
- Stripe publishable key is safe client‑side; do all secret actions server‑side.

---

## 🛠️ Architecture at a glance

- `src/components` — UI building blocks (Chat, Voice modal, Tool blocks, Overlays)
- `src/contexts` — App state (Chat, Settings, Notifications)
- `src/pages` — Pages (Pricing, Landing, Chat)
- `src/utils` — API, runtime config helper
- `src/css` — Theme variables + component styles

Backend (separate service): Node/Express with Stripe, chats, files, models, voice, integrations.

---

## 🤝 Contributing

PRs welcome. Please:
- Keep UX consistent with existing patterns
- Maintain accessibility and keyboard navigation
- Avoid introducing console noise
- Prefer small, focused changes with context in the PR description

---

## 🧭 Roadmap (selected)

- Optional native Maps SDK path for Android builds
- More tool blocks (calendar, mail, sheets)
- Offline and PWA upgrades
- Fine‑tuned streaming profiles for voice

---

## 📫 Support
And, if you want to support me, you can buy me a coffee!

<a href='https://ko-fi.com/W7W8124OZ7' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
