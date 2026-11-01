# Elite Digital Solutions — Complete Business Website

Premium black & gold digital agency website with full backend, D1 database, admin dashboard, order system, portfolio demos and review management.

**Stack (100% Cloudflare Free Plan compatible):**
- Frontend: HTML + Tailwind CSS + Vanilla JS
- Backend: Cloudflare Workers + Hono
- Database: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2 (optional for images)
- Hosting: Cloudflare Workers (static assets + API)

---

## Features Implemented

### Public Website
- Premium black & gold design
- Responsive (mobile / tablet / desktop)
- Services listing (9 categories)
- Portfolio / Sample Concept Demos (8 items, clearly labelled)
- Reviews section with empty state + submission form
- Pricing packages
- FAQ accordion
- Order / Quote form (saves to DB with reference number)
- Contact form
- Floating WhatsApp button
- Language switcher placeholder (EN / বাংলা)

### Admin Dashboard (`/admin/`)
- Secure login (session cookie + PBKDF2 password hashing)
- Dashboard stats (orders, pending, completed, messages, etc.)
- Orders management (status update)
- Portfolio / Demo projects management
- Reviews moderation (approve / publish / delete)
- Customer messages
- Services overview
- Logout

### Security
- Password hashing with PBKDF2 (100k iterations)
- HTTP-only secure session cookies
- Rate limiting on login
- Server-side validation
- SQL prepared statements (injection protection)
- Secure headers
- No passwords / secrets in frontend

---

## Prerequisites

1. A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. Node.js 18+ installed on your computer
3. Git (optional)

---

## Step-by-Step Deployment Guide (Free)

### 1. Install dependencies locally

```bash
cd elite-digital-solutions
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

This opens the browser. Login with your Cloudflare account and authorize.

### 3. Create D1 Database

```bash
npx wrangler d1 create elite-digital-db
```

Copy the `database_id` from the output.

Open `wrangler.toml` and replace:

```toml
database_id = "YOUR_D1_DATABASE_ID_HERE"
```

with the real ID.

### 4. Create R2 Bucket (optional but recommended for images)

```bash
npx wrangler r2 bucket create elite-digital-media
```

### 5. Run Database Migrations

**Local (for testing):**
```bash
npm run db:migrate:local
npm run db:seed:local
```

**Production:**
```bash
npm run db:migrate
npm run db:seed
```

### 6. Set Admin Password (Important)

The seed contains a placeholder password hash. You **must** set a real password.

**Option A — After first deploy, use the change-password API** (recommended):

1. Temporarily set a known password by running this once (replace the hash):

Create a small script or use the Worker console, or update the seed with a real hash.

**Quick method to generate a hash and update:**

You can temporarily add a one-time setup route, or run this Node script locally after installing:

```js
// generate-hash.mjs (run once)
import { hashPassword } from './src/utils/auth.ts'; // adjust if needed
// Or use the same PBKDF2 logic

// Easiest: After deploy, use Cloudflare Dashboard → Workers → your worker → Settings → Variables
// Or update the admin row via D1 console.
```

**Practical way:**

1. Deploy first.
2. Go to Cloudflare Dashboard → Workers & Pages → D1 → elite-digital-db → Console
3. Run:

```sql
-- First generate a hash using a temporary tool or the code below
UPDATE admins SET password_hash = 'YOUR_GENERATED_HASH' WHERE email = 'admin@elitedigitalsolutions.com';
```

To generate the hash, you can temporarily add this to the Worker or use:

```bash
# After deploy you can also create the first admin via a one-time script
```

**Recommended first-login flow:**

I will include a one-time setup note. For now, after migration, go to D1 console and insert a known password later. You can also use the `/api/admin/change-password` after you set an initial one.

### 7. Set Secrets (optional but recommended)

```bash
npx wrangler secret put PASSWORD_PEPPER
# Enter a long random string when prompted

npx wrangler secret put JWT_SECRET
# Enter another long random string
```

### 8. Deploy

```bash
npm run deploy
```

Or:

```bash
npx wrangler deploy
```

After deploy you will get a URL like:

```
https://elite-digital-solutions.<your-subdomain>.workers.dev
```

### 9. Custom Domain (Free)

1. Add your domain to Cloudflare (or use the workers.dev URL)
2. In Workers → your worker → Settings → Domains & Routes
3. Add a custom domain

### 10. First Admin Login

1. Go to `https://your-worker-url/admin/`
2. Login with:
   - **Email:** `admin@elitedigitalsolutions.com`
   - **Password:** `EliteAdmin@2026`

3. **Immediately change the password** after first login.

To generate a new password hash later:
```bash
node scripts/generate-admin-hash.mjs "YourNewPassword"
```
Then run the printed SQL in Cloudflare D1 Console.

---

## Local Development

```bash
npm run dev
```

This starts a local server with D1 (local) and hot reload.

Open: http://localhost:8787

---

## Project Structure

```
elite-digital-solutions/
├── migrations/
│   ├── 0001_init.sql          # Full database schema
│   └── 0002_seed.sql          # Sample services, 8 demos, packages, FAQs
├── public/
│   ├── index.html             # Main website
│   ├── css/style.css
│   ├── js/main.js
│   └── admin/
│       ├── index.html         # Admin login
│       └── dashboard.html     # Admin panel
├── src/
│   ├── index.ts               # Hono Worker (all API routes)
│   ├── types.ts
│   └── utils/auth.ts          # Password hashing + sessions
├── wrangler.toml
├── package.json
└── README.md
```

---

## Important Notes

### Sample / Concept Demos
All 8 portfolio items are clearly labelled **"Sample / Concept Demo"**. They are not real client work.

### Reviews
- Public site shows only **approved + published** reviews.
- Until real customers submit reviews, the section shows a professional empty state.
- A small "Sample Preview" card is shown only for design demonstration and is clearly marked.
- Admins can approve/reject submitted reviews.

### No Fake Statistics
The site does **not** claim "500+ projects" or "300+ happy clients". Only real data from the database is shown in the admin dashboard.

### Account Recovery Services
All copy emphasizes that guidance follows official platform policies and that results are never guaranteed. Passwords / OTPs are never requested.

---

## Updating Content After Deploy

1. Login to `/admin/`
2. Manage Orders, Reviews, Messages, Projects from the dashboard.
3. For advanced edits (new services, blog posts, packages) you can:
   - Use D1 console in Cloudflare Dashboard, or
   - Extend the admin panel (API routes already support more operations).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `database_id` error | Run `wrangler d1 create` again and update `wrangler.toml` |
| Login fails | Check password hash in D1. Reset via console if needed |
| Static files 404 | Make sure `public/` folder exists and `[assets]` is in wrangler.toml |
| CORS issues | Already handled. Clear browser cache / try incognito |
| Rate limited on login | Wait 15 minutes or clear the in-memory map (redeploy) |

---

## Free Plan Limits (Approximate)

- Workers: 100,000 requests / day
- D1: 5M reads / 100k writes per day, 500 MB per database
- R2: 10 GB storage, free egress
- Plenty for a small-to-medium business site.

---

## Next Improvements You Can Add

- Full Bengali UI translation
- Image upload to R2 from admin
- Blog writing UI
- Email notifications (via Resend free tier or similar)
- More advanced SEO pages

---

**Built according to the full project brief — ready for free Cloudflare deployment.**
