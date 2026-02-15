# Final Deploy Checklist (LCDB)

## 1) Payload → GitHub (snapshot update)
- Payload env:
  - `ASTRO_WEBHOOK_URL=https://api.github.com/repos/lcdb-dev/Front-End/dispatches`
  - `GITHUB_DISPATCH_TOKEN=...`
  - `FORCE_WEBHOOKS=true` (testing only)
- Verify Payload logs show:
  - `[articles] webhook sent { status: 204, ... }`

## 2) GitHub Secrets (Front-End repo)
Add in **Settings → Secrets and variables → Actions**:
- `PAYLOAD_API_URL` → `https://YOUR-PAYLOAD-DOMAIN.com/api`
- `PAYLOAD_API_TOKEN` → required if Payload API is private
- `COOLIFY_DEPLOY_WEBHOOK` → Coolify deploy webhook URL
- `COOLIFY_API_TOKEN` → Coolify API token (Bearer)

## 3) Coolify env (Front-End build)
- `USE_LOCAL_JSON=1`
- `MAX_SSG_ARTICLES=5000`
- `BUILD_ONLY_ARTICLE_PAGES=1`
- `BUILD_RELATED=0` (optional, skip related articles build)
- `SEARCH_INDEX_LIMIT=5000` (optional)
- `BUILD_DISABLE_SEARCH=0` (optional)

## 4) LFS + snapshot file
- `prepared-articles.json` must be tracked by Git LFS.
- Confirm it exists in repo and is updated by workflow.

## 5) Quick sanity test
1. Update any article in Payload.
2. GitHub Action should run:
   **Payload Update Snapshot + Coolify Deploy**
3. Action should:
   - update `prepared-articles.json`
   - commit & push
   - trigger Coolify deploy (HTTP 200/204)
4. Check live site for the updated article.

## Notes
- If Coolify deploy returns `Unauthenticated`, check `COOLIFY_API_TOKEN`.
- If `No snapshot changes to commit`, ensure correct slug & valid `PAYLOAD_API_URL`.
- If build is slow, keep `BUILD_RELATED=0`.
