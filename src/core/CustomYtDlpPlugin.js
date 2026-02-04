/**
 * Custom yt-dlp plugin that avoids deprecated --no-call-home flag.
 * Uses the configured yt-dlp binary and parses JSON from stdout only.
 */

const { PlayableExtractorPlugin, Song, Playlist, DisTubeError } = require('distube');
const { spawn } = require('child_process');
const path = require('path');

function getYtDlpPath() {
    if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
    const dir = process.env.YTDLP_DIR || path.join('/tmp', 'yt-dlp');
    const filename = process.env.YTDLP_FILENAME || 'yt-dlp';
    return path.join(dir, filename);
}

function isPlaylist(info) {
    return Array.isArray(info.entries);
}

function runYtDlpJson(url, flags) {
    const args = [url, ...flags];
    const ytDlpPath = getYtDlpPath();

    return new Promise((resolve, reject) => {
        const child = spawn(ytDlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => reject(error));

        child.on('close', (code) => {
            if (code === 0) {
                try {
                    resolve(JSON.parse(stdout));
                } catch (error) {
                    reject(new Error(stderr || stdout || error.message));
                }
            } else {
                reject(new Error(stderr || stdout || `yt-dlp exited with code ${code}`));
            }
        });
    });
}

class YtDlpSong extends Song {
    constructor(plugin, info, options = {}) {
        super(
            {
                plugin,
                source: info.extractor,
                playFromSource: true,
                id: info.id,
                name: info.title || info.fulltitle,
                url: info.webpage_url || info.original_url,
                isLive: info.is_live,
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
                duration: info.is_live ? 0 : info.duration,
                uploader: {
                    name: info.uploader,
                    url: info.uploader_url,
                },
            },
            options
        );
    }
}

class CustomYtDlpPlugin extends PlayableExtractorPlugin {
    validate() {
        return true;
    }

    buildFlags(baseFlags) {
        const flags = [...baseFlags];
        if (process.env.YOUTUBE_COOKIES_PATH) {
            flags.push('--cookies', process.env.YOUTUBE_COOKIES_PATH);
        }
        return flags;
    }

    async resolve(url, options) {
        const info = await runYtDlpJson(url, this.buildFlags([
            '--dump-single-json',
            '--no-warnings',
            '--prefer-free-formats',
            '--skip-download',
            '--simulate',
        ])).catch((error) => {
            throw new DisTubeError('YTDLP_ERROR', `${error.message || error}`);
        });

        if (isPlaylist(info)) {
            if (info.entries.length === 0) {
                throw new DisTubeError('YTDLP_ERROR', 'The playlist is empty');
            }

            return new Playlist(
                {
                    source: info.extractor,
                    songs: info.entries.map((entry) => new YtDlpSong(this, entry, options)),
                    id: info.id?.toString(),
                    name: info.title,
                    url: info.webpage_url,
                    thumbnail: info.thumbnails?.[0]?.url,
                },
                options
            );
        }

        return new YtDlpSong(this, info, options);
    }

    async getStreamURL(song) {
        if (!song.url) {
            throw new DisTubeError('YTDLP_PLUGIN_INVALID_SONG', 'Cannot get stream URL from invalid song.');
        }

        const info = await runYtDlpJson(song.url, this.buildFlags([
            '--dump-single-json',
            '--no-warnings',
            '--prefer-free-formats',
            '--skip-download',
            '--simulate',
            '--format',
            'ba/ba*',
        ])).catch((error) => {
            throw new DisTubeError('YTDLP_ERROR', `${error.message || error}`);
        });

        if (isPlaylist(info)) {
            throw new DisTubeError('YTDLP_ERROR', 'Cannot get stream URL of an entire playlist');
        }

        return info.url;
    }

    getRelatedSongs() {
        return [];
    }
}

module.exports = { CustomYtDlpPlugin };
