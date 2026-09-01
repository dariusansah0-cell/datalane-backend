# DataLane GH — Backend

This is the missing piece behind the website: it verifies Paystack payments for real,
stores agents and orders permanently, and sends real SMS through Arkesel.

## 1. Set up a free database (MongoDB Atlas)
1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0** cluster (this tier is free forever, no card needed for it).
3. Under "Database Access", create a database user with a password.
4. Under "Network Access", add `0.0.0.0/0` (allow access from anywhere) — fine for a small business app.
5. Click "Connect" → "Drivers" → copy the connection string. It looks like:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/`
   Add `datalane` after the last `/` so it reads `.../datalane` — that's your `MONGODB_URI`.

## 2. Get your Paystack secret key
Dashboard → Settings → API Keys & Webhooks. Copy the **Secret Key** (starts `sk_test_` or
`sk_live_`). This is different from the public key already in the website — never put the
secret key in the website's own code, only here in the backend.

## 3. Set up SMS (Arkesel)
1. Register at https://arkesel.com (Ghana-based, accepts MoMo/card, easiest for a Ghanaian business).
2. Buy SMS credit and set up a Sender ID (e.g. "DataLane") — approval usually takes a day.
3. Copy your API key from the Arkesel dashboard.

## 4. Configure environment variables
Copy `.env.example` to `.env` and fill in every value: `MONGODB_URI`, `PAYSTACK_SECRET_KEY`,
`ADMIN_PASSWORD` (pick a strong one — this replaces the demo `admin123`), `JWT_SECRET` (any
long random string), `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`.

## 5. Deploy to Render (free)
1. Push this `backend` folder to a GitHub repository.
2. Go to https://render.com → New → Web Service → connect your repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Under "Environment", add every variable from your `.env` file.
5. Deploy. Render gives you a URL like `https://datalane-backend.onrender.com` — that's your `BACKEND_URL`.

Note: Render's free tier sleeps after 15 minutes of no traffic and takes ~30 seconds to
wake up on the next request. Fine for starting out; upgrade to a paid instance ($7/mo)
once you have steady traffic and don't want that delay.

## 6. Point the website at it
In `index.html`, set `CONFIG.BACKEND_URL` to your Render URL. Re-upload `index.html`
wherever you're hosting the site (Netlify, Vercel, GitHub Pages, or your own hosting all work
since it's a static file).

## 7. Test end-to-end
Use a Paystack **test** key first (`sk_test_...` / `pk_test_...` pair) and Paystack's test
card numbers (listed in their docs) to confirm an order goes Processing → Delivered and an
SMS actually arrives, before switching both keys to live.
