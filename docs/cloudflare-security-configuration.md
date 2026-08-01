# Cloudflare Security Configuration

The Cloudflare recommendations below are zone-level settings. Repository code can support them, but enabling the toggles requires access to the Cloudflare account that owns the production domain.

## Security.txt

GalibierHub now serves an RFC 9116 security contact file at:

- `https://seq-edge.vercel.app/.well-known/security.txt`
- `https://seq-edge.vercel.app/security.txt`

The contact and policy links are defined in `public/.well-known/security.txt` and `public/security.txt`. Update the `Contact:` line when the maintainer contact changes.

## Bot Fight Mode

1. Open the Cloudflare dashboard for the production domain.
2. Go to **Security -> Bots -> Configure**.
3. Enable **Bot Fight Mode**.
4. Review **Security -> Events** for requests labeled `Bot Fight Mode`.

Bot Fight Mode challenges traffic matching known bot patterns and helps protect public API and download endpoints from abuse.

## Block AI Bots

1. Open the Cloudflare dashboard for the production domain.
2. Go to **Security -> Bots**.
3. Enable **Block AI bots**.

The repository also blocks known AI crawlers in `public/robots.txt`, including GPTBot, ClaudeBot, Bytespider, Google-Extended, PerplexityBot, ChatGPT-User, OAI-SearchBot, Applebot-Extended, Amazonbot, Meta-ExternalAgent, Diffbot, and related agents. Academic crawlers such as Google Scholar and Semantic Scholar remain allowed.

## AI Labyrinth

1. Open the Cloudflare dashboard for the production domain.
2. Go to **Security -> Bots** or the AI Labyrinth section available in the security settings.
3. Enable **AI Labyrinth**.

AI Labyrinth adds bot-only links that disrupt crawlers which ignore standard crawling rules without changing visible page content.

## Verification

- Confirm `/.well-known/security.txt` returns the expected contact and policy.
- Confirm `public/robots.txt` is deployed and blocks the AI crawler list.
- In Cloudflare, open **Security -> Events** and filter by `Bot Fight Mode` after enabling the toggle.
- Re-scan the domain from Cloudflare's Security section after the new build is deployed.
