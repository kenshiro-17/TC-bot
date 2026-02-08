# TC-Bot Progress Log

## Summary
We migrated the bot from DisTube + yt-dlp to discord-player + discord-player-youtubei. The bot works locally, but Railway’s shared datacenter IPs are blocked by YouTube’s CDN (HTTP 403 on audio downloads). We attempted multiple fixes (headers, PoToken, player_id), but confirmed the block is IP-based. We then simplified the code to remove Railway-specific workarounds and decided to host on a non-datacenter IP (Raspberry Pi).

## What Happened (Chronological)
1. Replaced DisTube + yt-dlp with discord-player + discord-player-youtubei.
2. Rewrote all music commands and embed utilities for discord-player tracks/queues.
3. Fixed extractor registration order and upgraded youtubei extractor version.
4. Added search-first flow to /play to avoid extractor resolution issues.
5. Discovered stale cookies poisoned InnerTube; removed cookies and added fallback.
6. Investigated playback stopping immediately; added diagnostics and playerSkip handling.
7. Confirmed Railway IPs are blocked by YouTube CDN (403 on audio stream downloads).
8. Tried multiple workarounds (iOS headers, PoToken, player_id, STREAM_HEADERS, custom streams).
9. Concluded IP-based blocking is the root cause; moved away from Railway.
10. Simplified PlayerClient to default IOS client streaming (no Railway hacks).
11. Attempted Oracle Cloud Free Tier in Frankfurt; all Always Free shapes out of capacity.
12. Attempted Fly.io; blocked by requirement to add payment method.
13. Chose Raspberry Pi hosting to avoid CDN blocks.

## Current Code State
- Streaming uses default IOS client (no custom stream override).
- No PoToken, no player_id overrides.
- Debug logging restored to normal levels.

## Hosting Decision
- Oracle Cloud: blocked (capacity in Frankfurt).
- Fly.io: blocked (payment method required).
- Raspberry Pi: chosen (residential IP avoids CDN blocking).

## Todo
1. Buy Raspberry Pi 4B/5 (standalone board) + PSU + microSD.
2. Flash Ubuntu Server 24.04 ARM64.
3. SSH in and install Node.js 22, FFmpeg, Git, PM2.
4. Clone repo, run npm install, create .env.
5. Start bot with PM2 and test /play.

## Notes
- Railway/GCP IP ranges are blocked by YouTube CDN.
- PoToken helps API calls but does not bypass CDN IP blocks.
- A residential IP (Pi at home) should solve playback.
