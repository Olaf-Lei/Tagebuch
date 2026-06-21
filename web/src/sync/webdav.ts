import type { WebDAVConfig } from '../types'
import { ConflictError } from './errors'

const LS_ETAG_ENC = 'nc_etag_enc'
const LS_ETAG_DB  = 'nc_etag_db'

function buildUrl(config: WebDAVConfig, filename: string): string {
  const base = config.url.replace(/\/$/, '')
  const user = encodeURIComponent((config.davUser || config.username).trim())
  const encodedDir = config.dir
    .split('/')
    .map(seg => seg ? encodeURIComponent(seg) : '')
    .join('/')
  return `${base}/remote.php/dav/files/${user}${encodedDir}/${encodeURIComponent(filename)}`
}

function credHeaders(config: WebDAVConfig): Record<string, string> {
  return {
    'X-Webdav-Target': '',   // overwritten per call
    'X-Webdav-User': config.username,
    'X-Webdav-Pass': config.password,
  }
}

async function proxyGet(targetUrl: string, config: WebDAVConfig): Promise<Response> {
  return fetch('./proxy.php', {
    method: 'GET',
    headers: { ...credHeaders(config), 'X-Webdav-Target': targetUrl },
  })
}

async function proxyPut(targetUrl: string, config: WebDAVConfig, body: string | ArrayBuffer, contentType: string): Promise<Response> {
  return fetch('./proxy.php', {
    method: 'PUT',
    headers: { ...credHeaders(config), 'X-Webdav-Target': targetUrl, 'Content-Type': contentType },
    body,
  })
}

async function proxyMove(sourceUrl: string, destUrl: string, config: WebDAVConfig): Promise<Response> {
  return fetch('./proxy.php', {
    method: 'MOVE',
    headers: { ...credHeaders(config), 'X-Webdav-Target': sourceUrl, 'Destination': destUrl, 'Overwrite': 'T' },
  })
}

async function proxyDelete(targetUrl: string, config: WebDAVConfig): Promise<void> {
  await fetch('./proxy.php', {
    method: 'DELETE',
    headers: { ...credHeaders(config), 'X-Webdav-Target': targetUrl },
  }).catch(() => {})
}

// Returns normalised ETag (without quotes) or null if not available/404
async function _fetchEtag(url: string, config: WebDAVConfig): Promise<string | null> {
  const body = `<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:getetag/></D:prop></D:propfind>`
  const res = await fetch('./proxy.php', {
    method: 'PROPFIND',
    headers: { ...credHeaders(config), 'X-Webdav-Target': url, 'Depth': '0' },
    body,
  })
  if (!res.ok) return null
  const xml = await res.text()
  const m = xml.match(/<[Dd](?:AV)?:getetag[^>]*>([^<]+)</)
  return m ? m[1].trim().replace(/^"|"$/g, '') : null
}

// PUT body to .tmp, check ETag against stored value, then MOVE atomically
async function _uploadAtomic(
  tmpUrl: string,
  finalUrl: string,
  etagKey: string,
  config: WebDAVConfig,
  body: string | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const putRes = await proxyPut(tmpUrl, config, body, contentType)
  if (!putRes.ok) throw new Error(`Upload fehlgeschlagen: HTTP ${putRes.status}`)

  const storedEtag = localStorage.getItem(etagKey)?.replace(/^"|"$/g, '') ?? null
  if (storedEtag) {
    const currentEtag = await _fetchEtag(finalUrl, config)
    // currentEtag null → file doesn't exist or PROPFIND failed → allow
    if (currentEtag !== null && currentEtag !== storedEtag) {
      await proxyDelete(tmpUrl, config)
      throw new ConflictError()
    }
  }

  const moveRes = await proxyMove(tmpUrl, finalUrl, config)
  if (!moveRes.ok) {
    await proxyDelete(tmpUrl, config)
    throw new Error(`Upload fehlgeschlagen (MOVE): HTTP ${moveRes.status}`)
  }
  // ETag nach erfolgreichem Upload aktualisieren
  const newEtag = await _fetchEtag(finalUrl, config)
  if (newEtag) localStorage.setItem(etagKey, newEtag)
  else localStorage.removeItem(etagKey)
}

// Versucht zuerst .db.enc, dann .db. Speichert ETag für Konflikt-Erkennung.
export async function downloadAuto(config: WebDAVConfig): Promise<{ data: ArrayBuffer | string; isEnc: boolean }> {
  const encUrl = buildUrl(config, 'tagebuch.db.enc')
  const encRes = await proxyGet(encUrl, config)
  if (encRes.ok) {
    const etag = encRes.headers.get('ETag')
    if (etag) localStorage.setItem(LS_ETAG_ENC, etag)
    else localStorage.removeItem(LS_ETAG_ENC)
    return { data: await encRes.text(), isEnc: true }
  }

  const dbUrl = buildUrl(config, 'tagebuch.db')
  const dbRes = await proxyGet(dbUrl, config)
  if (dbRes.ok) {
    const etag = dbRes.headers.get('ETag')
    if (etag) localStorage.setItem(LS_ETAG_DB, etag)
    else localStorage.removeItem(LS_ETAG_DB)
    return { data: await dbRes.arrayBuffer(), isEnc: false }
  }

  throw new Error(`Datei nicht gefunden (${encUrl} → ${encRes.status}, ${dbUrl} → ${dbRes.status})`)
}

export async function uploadEncrypted(config: WebDAVConfig, text: string): Promise<void> {
  await _uploadAtomic(
    buildUrl(config, 'tagebuch.db.enc.tmp'),
    buildUrl(config, 'tagebuch.db.enc'),
    LS_ETAG_ENC,
    config, text, 'text/plain; charset=utf-8',
  )
}

export async function uploadPlain(config: WebDAVConfig, data: Uint8Array): Promise<void> {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  await _uploadAtomic(
    buildUrl(config, 'tagebuch.db.tmp'),
    buildUrl(config, 'tagebuch.db'),
    LS_ETAG_DB,
    config, buf, 'application/octet-stream',
  )
}
