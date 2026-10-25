# KB MAX Live SMS Gateway

## Environment (`.env`)
Copy `.env.example` to `.env`. **`ADMIN_PASSWORD` is required.** The admin username is fixed: `ITXKAMII`.
All other values are optional (see comments in `.env.example`).

## Local development
```
npm install
npm run dev        # NODE_ENV=development (Vite dev server)
```

## Deploy to the VPS (no build on the VPS)
1. On your computer: `bash build-release.sh` -> creates `release.tar.gz`
2. Upload it to the VPS, extract it into the app folder (the folder that contains `data/`)
3. Create `.env` there (from `.env.example`)
4. Run `bash vps-deploy.sh`

## Backups
All data lives in the `data/` folder (`storage.json`, `messages.ndjson`, `fingerprints.tsv`, `.datakey`).
Back up the whole folder. Keep `.datakey` (or your `DATA_KEY`) together with the backup, or client passwords can not be decrypted.
