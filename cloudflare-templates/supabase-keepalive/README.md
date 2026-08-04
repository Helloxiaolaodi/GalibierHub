# Supabase Keep-Alive Worker

This Cloudflare Worker prevents a free Supabase project from being paused after 7 days of inactivity. A Cloudflare Cron Trigger runs every 3 days and performs one lightweight anonymous SELECT against Supabase, which is enough activity to reset the idle timer.

## Files

- `worker.js`: the Cloudflare Worker script
- `wrangler.toml`: Worker name, cron trigger, and deployment configuration
- `.dev.vars.example`: local development secret template

## Deploy

Run these commands from this directory:

```bash
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put KEEPALIVE_SECRET
npx wrangler deploy
```

The first two secrets are the project URL and anon key from your Supabase project settings. Do not use the service-role key here.

`KEEPALIVE_SECRET` is optional. It protects the manual trigger endpoint so you can run a check without opening it to the public.

## What it does

The Worker calls:

```text
GET /rest/v1/genome_samples?select=id&limit=1
```

with the anon key. If your Supabase project uses a different table, set `SUPABASE_KEEPALIVE_TABLE` as a Worker variable or secret before deploying.

## Cron schedule

`wrangler.toml` configures:

```toml
triggers = { crons = ["0 0 */3 * *"] }
```

That runs at `00:00 UTC` every 3 days. You can change the schedule in Cloudflare's dashboard or in this file before redeploying.

## Local test

Create `.dev.vars` from `.dev.vars.example`, then run:

```bash
npx wrangler dev --test-scheduled
```

In another terminal, trigger the scheduled handler:

```bash
curl "http://127.0.0.1:8787/__scheduled?cron=0+0+*+*+*"
```

For a manual HTTP check after deployment:

```bash
curl -X POST "https://galibierhub-supabase-keepalive.<your-subdomain>.workers.dev/" \
  -H "Authorization: Bearer <KEEPALIVE_SECRET>"
```

The response should include `"status":"ok"`.
