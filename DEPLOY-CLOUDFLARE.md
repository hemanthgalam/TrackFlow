# Deploying TrackFlow to Cloudflare (Workers + D1)

TrackFlow runs on Cloudflare Workers with a Cloudflare D1 database, both on the free plan.
The same Express routes power the Node/Docker build (`app.js`) and the Worker (`worker.js`).

| Piece | Node / Docker | Cloudflare |
| --- | --- | --- |
| Entry point | `app.js` | `worker.js` |
| Database | Postgres (`db.js`), JSON file fallback | D1 / SQLite (`db-d1.js`) |
| Schema | created on boot | `migrations/` (applied with wrangler) |
| Templates | `views/` read at runtime | `views/` precompiled to `build/views.js` on each build |
| Static files | `express.static('public')` | Workers Static Assets (`public/`) |

## One-time setup

```sh
npm install

# 1. Sign in to your Cloudflare account (opens a browser)
npx wrangler login

# 2. Create the free D1 database
npx wrangler d1 create trackflow-db
```

Copy the `database_id` that the last command prints into `wrangler.jsonc`,
replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

```sh
# 3. Create the tables in the remote database
npm run cf:migrate

# 4. Deploy
npm run cf:deploy
```

Wrangler prints the live URL, e.g. `https://trackflow.<your-subdomain>.workers.dev`.
No secrets are needed: the Worker reaches D1 through the `DB` binding.

## Protect the app

The app has no login, so anyone with the URL can read and edit your applications.
Put it behind **Cloudflare Access** (free for up to 50 users): in the Cloudflare dashboard go to
Workers & Pages → trackflow → Settings → Domains & Routes, and enable Cloudflare Access on the
`workers.dev` route, then allow only your email address.

## Everyday commands

```sh
npm run cf:migrate:local   # create tables in the local D1 used by wrangler dev
npm run cf:dev             # run the Worker locally at http://localhost:8787
npm run cf:deploy          # deploy the current code
```

Schema changes go in a new numbered file under `migrations/`, applied with `npm run cf:migrate`.

## Automatic deploys from GitHub (optional)

In the dashboard, open Workers & Pages → trackflow → Settings → Builds and connect the
`hemanthgalam/TrackFlow` repository. Use `npx wrangler deploy` as the deploy command; every push
to `main` then deploys automatically.

## Free plan limits (for reference)

Workers: 100,000 requests per day. D1: 5 GB storage, 5 million rows read and 100,000 rows written
per day. A personal job tracker stays far below these.
