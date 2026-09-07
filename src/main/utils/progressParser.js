/**
 * Parses yt-dlp stdout lines for progress data and metadata.
 */

// [download]  42.3% of   45.23MiB at    3.20MiB/s ETA 00:09
const PROGRESS_REGEX =
  /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*([0-9a-zA-Z.]+)\s+at\s+([0-9a-zA-Z./]+)\s+ETA\s+([0-9:]+)/

// [download] Destination: /path/to/file.ext or "C:\path\to\file.ext"
const DEST_REGEX = /\[download\] Destination:\s*"?([^"\r\n]+)"?/

// [download] Downloading item 3 of 12 OR [download] Downloading video 3 of 12
const PLAYLIST_ITEM_REGEX =
  /\[download\]\s+Downloading\s+(?:item|video|track)\s+(\d+)\s+of\s+(\d+)/i

// [download] Downloading playlist: Playlist Title
const PLAYLIST_TITLE_REGEX =
  /\[download\]\s+Downloading\s+playlist:\s*(.+)/i

// [download] /path/to/file.mp4 has already been downloaded
const ALREADY_DOWNLOADED_REGEX =
  /\[download\]\s+"?([^"\r\n]+)"?\s+has already been downloaded/

// Fragment file pattern: video.f137.mp4, audio.f140.m4a (dot + f + digits + dot)
const FRAGMENT_REGEX = /\.f\d+\./

function parseProgress(line) {
  const match = line.match(PROGRESS_REGEX)
  if (!match) return null
  return {
    percent:   parseFloat(match[1]),
    totalSize: match[2],
    speed:     match[3],
    eta:       match[4]
  }
}

function parseDestination(line) {
  const match = line.match(DEST_REGEX)
  return match ? match[1].trim() : null
}

function parseAlreadyDownloaded(line) {
  const match = line.match(ALREADY_DOWNLOADED_REGEX)
  return match ? match[1].trim() : null
}

function parsePlaylistItem(line) {
  const match = line.match(PLAYLIST_ITEM_REGEX)
  if (!match) return null
  return {
    current: parseInt(match[1], 10),
    total: parseInt(match[2], 10)
  }
}

function parsePlaylistTitle(line) {
  const match = line.match(PLAYLIST_TITLE_REGEX)
  return match ? match[1].trim() : null
}

/**
 * Returns true if this line indicates the merger phase is starting.
 */
function parseMerging(line) {
  return line.includes('[Merger]') || line.includes('Merging formats into')
}

/**
 * Extracts the final merged output path from lines like:
 *   [Merger] Merging formats into "/path/to/file.mp4"
 *   Merging formats into "/path/to/file.mp4"
 */
function parseMergeDestination(line) {
  const match = line.match(/Merging formats into\s+"?([^"\r\n]+)"?/)
  return match ? match[1].trim() : null
}

/**
 * Returns true if the path looks like a yt-dlp intermediate fragment
 * (e.g. video.f137.mp4, audio.f140.m4a).
 */
function isFragmentPath(p) {
  if (!p) return false
  return FRAGMENT_REGEX.test(p) || p.endsWith('.part') || p.endsWith('.ytdl')
}

function parseCompleted(line) {
  return line.includes('[download] 100%') || line.includes('has already been downloaded')
}

export {
  parseProgress,
  parseDestination,
  parseAlreadyDownloaded,
  parsePlaylistItem,
  parsePlaylistTitle,
  parseMerging,
  parseMergeDestination,
  isFragmentPath,
  parseCompleted
}
