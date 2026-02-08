# TC-Bot (Discord Music Bot)

A Discord music bot that streams YouTube audio into voice channels. Built with **discord.js v14** and **discord-player v7** with **discord-player-youtubei** for reliable YouTube extraction.

## Architecture

```
index.js                          # Entry point, client setup, login
src/
  commands/
    index.js                      # Command loader & slash command registration
    play.js                       # /play <query> - play a song or add to queue
    skip.js                       # /skip - skip current track
    stop.js                       # /stop - stop playback, clear queue
    queue.js                      # /queue [page] - display queue with pagination
    nowplaying.js                 # /nowplaying - show current track + progress bar
    join.js                       # /join - join voice channel without playing
    leave.js                      # /leave - leave voice channel
  config/
    constants.js                  # Centralized config (volume, timeouts, colors, etc.)
  core/
    PlayerClient.js               # discord-player + YoutubeiExtractor setup, event handlers, idle timeout
  events/
    ready.js                      # Bot ready event (registers slash commands)
    interactionCreate.js          # Routes slash commands, enforces music channel
  utils/
    embed.js                      # Embed builders (nowPlaying, addedToQueue, queue, error, etc.)
    channelGuard.js               # Restricts music commands to #music-requests channel
    logger.js                     # Colored console logger with log levels
```

## Audio Pipeline

```
/play command
  -> discord-player routes query to YoutubeiExtractor
  -> youtubei.js calls YouTube InnerTube API (IOS client)
  -> Audio stream URL extracted (no signature deciphering needed)
  -> FFmpeg transcodes to Opus
  -> discord-voip streams to Discord voice gateway
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `discord.js` ^14.14.1 | Discord API |
| `discord-player` ^7.1.0 | Music queue & voice management |
| `discord-player-youtubei` ^1.5.0 | YouTube extraction via youtubei.js |
| `@discord-player/extractor` ^7.1.0 | Default extractors (SoundCloud, Spotify, etc.) |
| `ffmpeg-static` ^5.2.0 | Bundled FFmpeg binary |
| `dotenv` ^16.3.1 | Environment variable loading |

## Requirements

- Node.js `>=22.12.0` (see `.nvmrc`)
- FFmpeg available on PATH (or provided by `ffmpeg-static`)

## Local Dev

1. Install deps: `npm install`
2. Copy `.env.example` to `.env` and fill in values:
   ```
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_app_client_id
   GUILD_ID=                         # optional, for instant command registration
   YOUTUBE_COOKIES_BASE64=           # optional, base64-encoded Netscape cookies
   LOG_LEVEL=info                    # debug | info | warn | error
   ```
3. Run: `npm run dev` (watch mode) or `npm start`

## Railway Deploy

This repo includes `nixpacks.toml`, which installs FFmpeg and pins Node 22.12.0 on Railway.

1. Connect the repo in Railway.
2. Set env vars: `DISCORD_TOKEN`, `CLIENT_ID`.
3. Optional env vars: `GUILD_ID`, `YOUTUBE_COOKIES_BASE64`, `LOG_LEVEL`.
4. Deploy and use `/play` in `#music-requests`.

Push to `master` on GitHub and Railway auto-deploys.

### YouTube Cookies (optional)

For age-restricted content, export YouTube cookies from your browser as a Netscape-format `cookies.txt`, base64-encode them, and set `YOUTUBE_COOKIES_BASE64`. The bot writes them to `/tmp/youtube-cookies.txt` at startup.

## Key Design Decisions

- **All music commands restricted to `#music-requests`** channel (auto-created if missing) via `channelGuard.js`
- **YoutubeiExtractor registered before default extractors** and default YouTube handlers disabled to prevent URL conflicts
- **IOS client used for streaming** (default in discord-player-youtubei; ANDROID is blocked by YouTube)
- **Idle timeout** (5 min) auto-disconnects when bot is alone in voice channel
- **leaveOnEmpty/leaveOnEnd/leaveOnStop all disabled** in queue options; idle timeout handles disconnection instead

---

## v2.0 Migration Notes (Feb 2026)

### What changed

The bot was migrated from **DisTube + yt-dlp** to **discord-player + discord-player-youtubei**.

### Why

DisTube relied on `yt-dlp` (a command-line YouTube downloader) which frequently broke due to YouTube's anti-bot measures. The `yt-dlp` binary needed constant updates and still produced 403 errors, broken signatures, and extraction failures.

`discord-player-youtubei` uses `youtubei.js`, which communicates with YouTube via the same internal InnerTube API that YouTube's own apps use. This is fundamentally more stable than scraping the web player.

### What was removed

| Removed | Replacement |
|---------|------------|
| `distube` ^5.2.3 | `discord-player` ^7.1.0 |
| `@distube/yt-dlp` ^2.0.1 | `discord-player-youtubei` ^1.5.0 |
| `@discordjs/opus` ^0.10.0 | `mediaplex` (bundled with discord-player v7) |
| `@discordjs/voice` ^0.18.0 | `discord-voip` (bundled with discord-player v7) |
| `opusscript` ^0.1.1 | Not needed |
| `libsodium-wrappers` ^0.7.13 | Not needed |
| `python3` in nixpacks | Not needed (no yt-dlp) |

### Files removed

- `src/core/DistubeClient.js` - DisTube setup, yt-dlp binary management, FFmpeg detection
- `src/core/CustomYtDlpPlugin.js` - Custom yt-dlp plugin (avoided deprecated flags)
- `src/events/distube/playSong.js`
- `src/events/distube/addSong.js`
- `src/events/distube/error.js`
- `src/events/distube/disconnect.js`
- `src/events/distube/finish.js`

### Files added

- `src/core/PlayerClient.js` - discord-player setup, YoutubeiExtractor registration with cookie fallback, all event handlers (playerStart, audioTrackAdd, audioTracksAdd, playerError, playerSkip, error, emptyQueue, disconnect), idle timeout logic

### API migration mapping

| DisTube API | discord-player API |
|-------------|-------------------|
| `distube.play(channel, query)` | `player.play(channel, query, { nodeOptions, requestedBy })` |
| `distube.skip(guildId)` | `queue.node.skip()` |
| `distube.stop(guildId)` | `queue.delete()` |
| `distube.getQueue(guildId)` | `useQueue(guildId)` |
| `queue.songs[0]` | `queue.currentTrack` |
| `queue.songs` (array) | `queue.tracks` (collection) + `queue.currentTrack` |
| `queue.currentTime` | `queue.node.getTimestamp()` |
| `queue.voiceChannel` | `queue.channel` |
| `queue.textChannel` | `queue.metadata.channel` |
| `song.name` | `track.title` |
| `song.user` | `track.requestedBy` |
| `song.duration` (seconds) | `track.durationMS` (milliseconds) / `track.duration` (string) |
| `distube.voices.join(channel)` | `player.queues.create(guildId, opts)` + `queue.connect(channel)` |
| `distube.voices.leave(guildId)` | `queue.delete()` |
| Event: `playSong` | Event: `playerStart` |
| Event: `addSong` | Event: `audioTrackAdd` |
| Event: `finish` | Event: `emptyQueue` |

### Post-migration fixes

**Extractor not found (6c416c7):** YouTube URLs returned `NoResultError` with `Extractor: N/A`. The default extractors included a YouTube query detector that claimed the URL but couldn't play it (YouTube support was removed from defaults in v7). Fixed by registering `YoutubeiExtractor` before `DefaultExtractors` and upgrading `discord-player-youtubei` from 1.3.1 to 1.5.0.

**Search returning 0 results (7690150):** Added search-first approach in `/play` — calls `player.search()` then passes the `SearchResult` to `player.play()` for better diagnostics and reliability.

**Stale cookies poisoning InnerTube (25be653):** Expired YouTube cookies caused the InnerTube session to silently fail, making ALL searches return 0 results. Added a cookie fallback strategy: try with cookies, verify with a test search, and re-register without cookies if the test fails.

**ANDROID client stream URLs blocked (d24f753):** YouTube blocked ANDROID client stream URLs, causing silent stream failures (FFmpeg "premature close" errors swallowed by discord-player). Switched to the default `IOS` client. Added `playerSkip` event handler to surface `ERR_NO_STREAM` failures instead of silently skipping tracks.
