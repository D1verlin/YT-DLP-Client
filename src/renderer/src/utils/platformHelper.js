/**
 * Platform detector and formatting utilities for yt-dlp client.
 */

export function detectPlatform(url = '', extractorKey = '') {
  const lowerUrl = (url || '').toLowerCase()
  const lowerKey = (extractorKey || '').toLowerCase()

  if (lowerUrl.includes('music.youtube.com')) {
    return { name: 'YouTube Music', key: 'yt-music', color: '#ef5350', badgeCls: 'plat-youtube' }
  }
  if (lowerUrl.includes('/shorts/')) {
    return { name: 'YouTube Shorts', key: 'yt-shorts', color: '#ef5350', badgeCls: 'plat-youtube' }
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be') || lowerKey.includes('youtube')) {
    return { name: 'YouTube', key: 'youtube', color: '#ef5350', badgeCls: 'plat-youtube' }
  }
  if (lowerUrl.includes('vk.com') || lowerUrl.includes('vkvideo.ru') || lowerKey.includes('vk')) {
    return { name: 'VK Видео', key: 'vk', color: '#ffffff', badgeCls: 'plat-vk' }
  }
  if (lowerUrl.includes('rutube.ru') || lowerKey.includes('rutube')) {
    return { name: 'Rutube', key: 'rutube', color: '#ffffff', badgeCls: 'plat-rutube' }
  }
  if (lowerUrl.includes('tiktok.com') || lowerKey.includes('tiktok')) {
    return { name: 'TikTok', key: 'tiktok', color: '#ffffff', badgeCls: 'plat-tiktok' }
  }
  if (lowerUrl.includes('instagram.com') || lowerKey.includes('instagram')) {
    return { name: 'Instagram', key: 'instagram', color: '#ffffff', badgeCls: 'plat-instagram' }
  }
  if (lowerUrl.includes('twitch.tv') || lowerKey.includes('twitch')) {
    return { name: 'Twitch', key: 'twitch', color: '#ffffff', badgeCls: 'plat-twitch' }
  }
  if (lowerUrl.includes('soundcloud.com') || lowerKey.includes('soundcloud')) {
    return { name: 'SoundCloud', key: 'soundcloud', color: '#ffffff', badgeCls: 'plat-soundcloud' }
  }
  if (lowerUrl.includes('vimeo.com') || lowerKey.includes('vimeo')) {
    return { name: 'Vimeo', key: 'vimeo', color: '#ffffff', badgeCls: 'plat-vimeo' }
  }
  if (lowerUrl.includes('bilibili.com') || lowerKey.includes('bilibili')) {
    return { name: 'Bilibili', key: 'bilibili', color: '#ffffff', badgeCls: 'plat-bilibili' }
  }
  if (lowerUrl.includes('t.me') || lowerUrl.includes('telegram.org') || lowerKey.includes('telegram')) {
    return { name: 'Telegram', key: 'telegram', color: '#ffffff', badgeCls: 'plat-telegram' }
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerKey.includes('twitter')) {
    return { name: 'X / Twitter', key: 'twitter', color: '#ffffff', badgeCls: 'plat-twitter' }
  }

  return {
    name: extractorKey || 'Медиа',
    key: 'generic',
    color: '#888888',
    badgeCls: 'plat-generic'
  }
}

/**
 * Formats speed string in Russian (e.g. "4.52MiB/s" -> "4.52 МБ/с")
 */
export function formatSpeed(speed) {
  if (!speed) return ''
  return speed
    .replace(/GiB\/s/gi, ' ГБ/с')
    .replace(/MiB\/s/gi, ' МБ/с')
    .replace(/KiB\/s/gi, ' КБ/с')
    .replace(/B\/s/gi, ' Б/с')
}

/**
 * Formats size string in Russian (e.g. "45.23MiB" -> "45.23 МБ")
 */
export function formatSize(size) {
  if (!size) return ''
  return size
    .replace(/GiB/gi, ' ГБ')
    .replace(/MiB/gi, ' МБ')
    .replace(/KiB/gi, ' КБ')
    .replace(/B/gi, ' Б')
}

/**
 * Calculates aggregate speed from all active tasks in bytes/sec and returns localized string
 */
export function calculateTotalSpeed(tasks = []) {
  let totalBytesPerSec = 0

  for (const t of tasks) {
    if (t.status !== 'downloading' || !t.speed) continue
    const match = t.speed.match(/([\d.]+)\s*([a-zA-Z/]+)/)
    if (!match) continue
    const val = parseFloat(match[1])
    const unit = match[2].toLowerCase()

    if (unit.includes('gib')) {
      totalBytesPerSec += val * 1024 * 1024 * 1024
    } else if (unit.includes('mib')) {
      totalBytesPerSec += val * 1024 * 1024
    } else if (unit.includes('kib')) {
      totalBytesPerSec += val * 1024
    } else {
      totalBytesPerSec += val
    }
  }

  if (totalBytesPerSec === 0) return ''
  if (totalBytesPerSec >= 1024 * 1024 * 1024) {
    return `${(totalBytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} ГБ/с`
  }
  if (totalBytesPerSec >= 1024 * 1024) {
    return `${(totalBytesPerSec / (1024 * 1024)).toFixed(1)} МБ/с`
  }
  if (totalBytesPerSec >= 1024) {
    return `${Math.round(totalBytesPerSec / 1024)} КБ/с`
  }
  return `${Math.round(totalBytesPerSec)} Б/с`
}

/**
 * Formats duration in seconds to "HH:MM:SS" or "MM:SS"
 */
export function formatDuration(sec) {
  if (!sec || isNaN(sec)) return null
  const s = Math.floor(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const remSec = s % 60

  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(remSec)}`
  return `${m}:${pad(remSec)}`
}
