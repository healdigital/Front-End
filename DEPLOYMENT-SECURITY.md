# Secure Deploy: Avoid Secret Exposure in Build Logs

This project now includes a custom multi-stage `Dockerfile` and does not require secret build args.

## What changed in repo

- Added root `Dockerfile` (Node build stage -> Nginx runtime stage).
- Added `nginx.conf` for static Astro output.
- Added `.dockerignore` to keep `.env` and other local data out of Docker build context.

## Required Coolify settings

To fully stop secret names from appearing in deploy logs/history:

1. Use `Dockerfile` (or `Docker Compose`) build type, not Nixpacks.
2. Disable **Inject Build Args to Dockerfile**.
3. Move sensitive variables to **runtime-only** (not build-time):
   - `DEEPL_API_KEY`
   - `PAYLOAD_SECRET`
   - `DATABASE_URL`
   - `GITHUB_DISPATCH_TOKEN`
4. Redeploy.

## Why this matters

- Nixpacks auto-injects build args for build-time variables.
- Those arg names can appear in build logs and image metadata.
- With Dockerfile mode + no secret build args, secret names/values are not part of Docker build history.

## Optional: BuildKit secret for non-sensitive build config

If you need build-time config without `--build-arg`, use secret mount:

```bash
docker build --secret id=build_env,src=.env.build -t lcdb-astro:secure .
```

`Dockerfile` already supports optional `build_env` secret.
