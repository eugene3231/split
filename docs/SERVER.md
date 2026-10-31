# Scan server

`server/` is the receipt scan server. It holds one Gemini key so people without their own can scan. It runs as the `split-api` container behind a Cloudflare Tunnel, and the app never gets the key.

The rule it enforces is that nothing reaches Gemini without a valid pass and room under both daily limits.

## Run it locally

```bash
export GEMINI_API_KEY=your-key TURNSTILE_SECRET=1x0000000000000000000000000000000AA DATA_DIR=./.data
pnpm build:server && pnpm start:server
```

The secret above is Cloudflare's published always-pass test secret. `server/test/stubGemini.ts` stands in for Gemini when you do not want to spend a real call. Run it with `node server/test/stubGemini.ts --port 8090` and set `GEMINI_BASE_URL=http://localhost:8090`.

The image is built with `docker build -t split-api .` and `.github/workflows/image.yml` builds it on every PR. The image is never pushed. The NAS builds it from source.

## Variables

The server parses all of these once at startup in `server/src/env.ts` and refuses to start on a bad value.

| Variable                   | Default                                     | Meaning                                                                         |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`           | required                                    | The shared key.                                                                 |
| `TURNSTILE_SECRET`         | required                                    | Cloudflare Turnstile secret for the bot check.                                  |
| `SCAN_MODEL`               | `gemini-3.1-flash-lite`                     | One of `GEMINI_MODELS`. The server ignores any model the client asks for.       |
| `GEMINI_BASE_URL`          | `https://generativelanguage.googleapis.com` | Where Gemini is. Tests and lanes point it at the stub.                          |
| `ALLOWED_ORIGINS`          | none                                        | Comma-separated origins allowed by CORS.                                        |
| `ALLOWED_ORIGIN_PATTERN`   | none                                        | Regex for more origins, such as Netlify previews. Anchored by the server.       |
| `TRUST_CF_CONNECTING_IP`   | `0`                                         | `1` reads the client address from `CF-Connecting-IP`. See below.                |
| `DATA_DIR`                 | `/data`                                     | Where `split.db` lives. It must be writable by uid 1001 gid 10.                 |
| `PORT`                     | `8080`                                      | Listen port.                                                                    |
| `SCAN_LIMIT_PER_DEVICE`    | `20`                                        | Scans per phone per day.                                                        |
| `SCAN_LIMIT_GLOBAL`        | `200`                                       | Scans per day across all phones.                                                |
| `DEVICE_MINT_LIMIT_PER_IP` | `10`                                        | New passes per client address per day.                                          |
| `APP_VERSION`              | `dev`                                       | Shown by the health route. The image sets it from the build argument `GIT_SHA`. |

## Routes

Every route is under `/api/v1/`. The request and response shapes are in `src/shared/api/`, and the browser parses every body with the same zod schemas.

- `GET /health` returns `{ ok, version, migrations }`.
- `POST /devices` takes a Turnstile token and returns a random 256-bit pass. The server stores only its SHA-256 hash. This is the only route that reads the client address.
- `POST /scan` needs `Authorization: Bearer <pass>` and takes the raw image bytes as the body, with the image type as `Content-Type` (JPEG, PNG, WebP, HEIC, HEIF or PDF, up to 10 MiB). It returns `{ receipt }`.

The order on `/scan` is the pass (401), the body (415, 413 or 408), the limits (429), then Gemini. Nothing is counted until the body has passed.

Every error body carries a `kind`, and the browser decides on that kind. Only a bad photo (`bad-image`) and a missing pass (`needs-device`, handled by minting one and retrying once) do not ask the user for a key.

## Limits

A day is a calendar day in Singapore time (UTC+8), so limits reset at 16:00 UTC. Counts live in `daily_counters`. A scan reserves one count from the phone and one from the global total before Gemini is called, in one transaction. It gives both back when the failure is not the phone's doing: a network error, a timeout, Gemini 429 or 5xx, or Gemini 401, 403 or 404 (the server key or model is wrong). It keeps them when Gemini rejected the photo with another 4xx such as 400 (answered 422 `bad-image`), and when Gemini answered but the output could not be read, because Gemini billed for that call or the phone supplied the input.

Before the body is read, a scan checks both daily limits without counting (429 `over-limit` when either is used up), then takes an in-flight slot: one scan at a time per phone and four in all. A refused scan gets 503 `unreachable` with `Retry-After: 5`. The slot is released when the scan ends, however it ends. Rows older than two days are removed at startup and at the first request of a new day.

Mint limits count by `sha256(day + address)`, so no raw address is stored or logged.

## Behind the tunnel

`CF-Connecting-IP` is only trustworthy when nothing but `cloudflared` can reach the server port. With `TRUST_CF_CONNECTING_IP=1` a mint without a valid header gets 400 `misconfigured` and never falls back to the socket address, which would put every user in one bucket. The deploy puts `split-api` on a network that only `cloudflared` joins.

## Data and migrations

The database is `${DATA_DIR}/split.db` in WAL mode. Numbered SQL files in `server/src/db/migrations/` run at startup, each in one transaction, and are recorded in `schema_migrations`. The server refuses to start when the database holds a migration the code does not know, so an old image cannot run on a newer database. A later feature adds the next numbered file and one `app.route` line.

## Logs

One JSON line per request: route, status, kind, bytes, duration and token counts. The server never logs an image, a Gemini answer, a key, a pass or an address.
