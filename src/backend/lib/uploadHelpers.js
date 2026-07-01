const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const UPLOAD_ROOT = path.join(__dirname, '../../uploads')

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'application/octet-stream': '.bin',
}

const EXT_MIME = Object.fromEntries(
  Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime]),
)

const ALLOWED_MIMES = new Set(Object.keys(MIME_EXT).filter((m) => m !== 'application/octet-stream'))

function ensureDir(subfolder = 'general') {
  const dir = path.join(UPLOAD_ROOT, subfolder)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function parseBase64Input(fileBase64) {
  const raw = String(fileBase64)
  const match = /^data:([^;]+);base64,(.+)$/i.exec(raw)
  if (match) {
    return { mime: match[1], buffer: Buffer.from(match[2], 'base64') }
  }
  return { mime: 'application/octet-stream', buffer: Buffer.from(raw, 'base64') }
}

function publicBaseUrl() {
  return (
    process.env.API_PUBLIC_URL ||
    process.env.APP_URL ||
    `http://localhost:${process.env.PORT || 4000}`
  ).replace(/\/$/, '')
}

function inferMimeFromName(name, fallback = 'application/octet-stream') {
  const ext = path.extname(String(name || '').toLowerCase())
  return EXT_MIME[ext] || fallback
}

function resolveUploadMime(mime, originalName) {
  const normalized = String(mime || '').toLowerCase()
  if (normalized && normalized !== 'application/octet-stream' && ALLOWED_MIMES.has(normalized)) {
    return normalized
  }
  const fromName = inferMimeFromName(originalName)
  if (ALLOWED_MIMES.has(fromName)) return fromName
  if (normalized && normalized !== 'application/octet-stream') return normalized
  return fromName
}

async function storeLocalUpload({ fileBase64, folder = 'general', originalName }) {
  let { mime, buffer } = parseBase64Input(fileBase64)
  mime = resolveUploadMime(mime, originalName)
  if (!buffer.length) throw new Error('Empty file payload')
  if (!ALLOWED_MIMES.has(mime)) {
    throw new Error(`File type not allowed: ${mime}`)
  }

  const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024)
  if (buffer.length > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes limit`)

  const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '') || 'general'
  const ext = MIME_EXT[mime] || '.bin'
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`
  const dir = ensureDir(safeFolder)
  const filePath = path.resolve(dir, filename)
  if (!filePath.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error('Invalid upload path')
  }
  fs.writeFileSync(filePath, buffer)

  const relative = `${safeFolder}/${filename}`
  return {
    url: `${publicBaseUrl()}/uploads/${relative}`,
    path: relative,
    mime,
    size: buffer.length,
    storage: 'local',
  }
}

async function uploadFile({ fileBase64, folder, resourceType, originalName }) {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    const cloudinary = require('cloudinary').v2
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: folder || 'school-uploads',
      resource_type: resourceType || 'auto',
    })
    return {
      url: result.secure_url,
      publicId: result.public_id,
      storage: 'cloudinary',
    }
  }

  return storeLocalUpload({ fileBase64, folder, originalName })
}

module.exports = {
  UPLOAD_ROOT,
  storeLocalUpload,
  uploadFile,
  publicBaseUrl,
}
