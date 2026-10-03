import { supabase } from './supabase'

export const IMAGE_BUCKET = 'shop-images'
export const AVATAR_BUCKET = 'avatars'
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024 // what people may pick (phone photos can be big)
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 // what the storage bucket accepts
const MAX_SIDE = 1600 // px: sharp on retina cards and product pages, far smaller than a 12 MP photo
const MIN_SIDE = 32 // px: anything smaller is not a real picture
const MAX_PIXELS = 60_000_000 // refuse decompression bombs before they reach the canvas

// What we accept. The browser has to be able to decode it; what we upload is always a fresh
// WebP (or JPEG) made on a canvas, never the original bytes.
export const ACCEPT_ATTR = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif'
const EXT_TO_KIND = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif', heic: 'heic', heif: 'heic' }
const MIME_TO_KIND = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heic',
}
const OUT_EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg' }

const processed = new WeakSet() // files we already optimised, so uploadImage doesn't redo the work

/** Cheap first check on name, MIME type and size. Returns an error message, or ''. */
export function checkImage(file) {
  if (!file) return ''
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || ''
  const mimeKind = MIME_TO_KIND[file.type]
  // Some phones report HEIC with an empty MIME type, so the extension may stand in for it.
  const kind = mimeKind || (!file.type ? EXT_TO_KIND[ext] : undefined)
  if (!kind) return 'Please choose a JPG, PNG, WebP, GIF or HEIC image.'
  if (EXT_TO_KIND[ext] && EXT_TO_KIND[ext] !== kind) return 'This file’s name does not match its type. Please choose a real image.'
  if (file.size > MAX_ORIGINAL_BYTES) return 'Images must be 15 MB or smaller.'
  if (file.size < 100) return 'This file is empty or damaged. Please choose another image.'
  return ''
}

/** Looks at the first bytes of the file (not the name or MIME type) and says what it really is. */
export function sniffImageKind(bytes) {
  const b = bytes
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to))
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (b.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'gif'
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'].includes(brand)) return 'heic'
  }
  return null
}

/** Sizes to draw at. Never upscales; only shrinks when the longest side is over `max`. */
export function targetSize(width, height, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale }
}

/** Quality ladder: small files stay near-lossless, big ones get a lighter touch, all stay sharp. */
export function qualityFor(bytes) {
  if (bytes < 300 * 1024) return 0.92
  if (bytes < 2 * 1024 * 1024) return 0.86
  return 0.82
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

async function readKind(file) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  return sniffImageKind(head)
}

/**
 * Validates the real file contents, then re-draws the image (EXIF and other metadata are
 * dropped by doing so) at no more than 1600px on the longest side, as WebP with a JPEG
 * fallback. Transparent areas stay transparent in WebP and become white in the JPEG fallback.
 * Returns { blob, width, height, originalBytes, optimizedBytes, savedPercent }.
 */
export async function prepareImage(file) {
  const problem = checkImage(file)
  if (problem) throw new Error(problem)

  const real = await readKind(file)
  if (!real) throw new Error('This file is not a valid image. Please choose a JPG, PNG, WebP, GIF or HEIC image.')
  const claimed = MIME_TO_KIND[file.type]
  if (claimed && claimed !== real) throw new Error('This file is not what its name says. Please choose a real image.')

  let bitmap
  try {
    bitmap = await createImageBitmap(file) // honours the photo's rotation
  } catch {
    throw new Error(
      real === 'heic'
        ? 'This browser can’t open HEIC photos. Please choose a JPG or PNG, or set your camera to “Most Compatible”.'
        : 'This file isn’t a readable image. Please choose another one.',
    )
  }
  try {
    if (bitmap.width < MIN_SIDE || bitmap.height < MIN_SIDE) throw new Error('This image is too small. Please choose one at least 32 × 32 pixels.')
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new Error('This image has too many pixels. Please choose a smaller one.')

    const { width, height } = targetSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot process images.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q))
    const q0 = qualityFor(file.size)
    let blob = await toBlob('image/webp', q0)
    if (!blob || blob.type !== 'image/webp') {
      // No WebP encoder: JPEG has no transparency, so flatten onto white first.
      const flat = document.createElement('canvas')
      flat.width = width
      flat.height = height
      const fctx = flat.getContext('2d')
      if (!fctx) throw new Error('This browser cannot process images.')
      fctx.fillStyle = '#fff'
      fctx.fillRect(0, 0, width, height)
      fctx.drawImage(canvas, 0, 0)
      blob = await new Promise((resolve) => flat.toBlob(resolve, 'image/jpeg', Math.max(q0, 0.88)))
    }
    // Over the bucket limit: lower the quality in small steps, only as far as needed.
    for (const q of [0.78, 0.7, 0.62]) {
      if (!blob || blob.size <= MAX_UPLOAD_BYTES) break
      blob = await toBlob(blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg', q)
    }
    // An already well-compressed file can grow slightly when re-encoded: try once more, lighter.
    if (blob && blob.size >= file.size && blob.size <= MAX_UPLOAD_BYTES) {
      const lighter = await toBlob(blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.8)
      if (lighter && lighter.size < blob.size) blob = lighter
    }
    if (!blob) throw new Error('This image couldn’t be processed. Please try another one.')
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error('This image is too large even after optimising. Please choose a smaller one.')

    const savedPercent = Math.max(0, Math.round((1 - blob.size / file.size) * 100))
    const out = new File([blob], `image.${OUT_EXT[blob.type] ?? 'jpg'}`, { type: blob.type })
    processed.add(out)
    return { blob: out, width, height, originalBytes: file.size, optimizedBytes: out.size, savedPercent }
  } finally {
    bitmap?.close?.()
  }
}

/** Uploads into the uploader's own folder (enforced by storage policies). Returns the public URL. */
export async function uploadImage(userId, file, kind, bucket = IMAGE_BUCKET) {
  const prepared = processed.has(file) ? file : (await prepareImage(file)).blob
  const blob = prepared
  const ext = OUT_EXT[blob.type] ?? 'jpg'
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${userId}/${kind}-${Date.now()}-${rand}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // file names are unique, so they can be cached for a year
    upsert: false,
  })
  if (error) throw new Error('The image couldn’t be uploaded. Please try again.')
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Best-effort removal of an image we uploaded earlier. Ignores URLs from elsewhere. */
export async function removeImage(publicUrl, bucket = IMAGE_BUCKET) {
  if (!publicUrl) return
  const marker = `/storage/v1/object/public/${bucket}/`
  const i = publicUrl.indexOf(marker)
  if (i < 0) return
  const path = decodeURIComponent(publicUrl.slice(i + marker.length).split('?')[0])
  await supabase.storage.from(bucket).remove([path])
}
