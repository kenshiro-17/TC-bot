# Discord Music Bot

High-performance Discord music bot using DisTube + yt-dlp.

## Requirements
- Node.js `>=22.12.0` (see `.nvmrc`)
- FFmpeg available on PATH

## Local Dev
1. Install deps:
   - `npm install`
2. Create `.env`:
   - `DISCORD_TOKEN=...`
   - `CLIENT_ID=...`
   - `GUILD_ID=...` (optional, faster command registration)
3. Run:
   - `npm run dev`

## Railway Deploy
This repo includes `nixpacks.toml`, which installs FFmpeg and pins Node `22.12.0` on Railway.

Steps:
1. Connect the repo in Railway.
2. Set env vars:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID` (optional)
3. Deploy and use `/play` in `#music-requests`.
