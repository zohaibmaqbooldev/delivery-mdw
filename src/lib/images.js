import { supabase } from './supabase'

export const IMAGE_BUCKET = 'shop-images'
export const AVATAR_BUCKET = 'avatars'
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024 // what people may pick
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 // what the storage bucket accepts
const MAX_SIDE = 1200 // px — plenty for shop/product/profile images
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Returns an error message, or '' if the file can be used. */
export function checkImage(file) {
  if (!file) return ''
  if (!TYPES[file.type]) return 'Please choose a JPG, PNG or WebP image.'
  if (file.size > MAX_ORIGINAL_BYTES) return 'Images must be 10 MB or smaller.'
  return ''
}

/**
 * Re-draws the image on a canvas, at most 1200px on the longest side, as WebP (or JPEG
 * if the browser can't encode WebP). This shrinks large photos a lot and also means we
 * only ever upload real, freshly encoded pixels — never the original file's bytes.
 */
async function compress(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This file isn't a readable image. Please choose another JPG, PNG or WebP image.")
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q))
  let blob = await toBlob('image/webp', 0.82)
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85)
  if (blob && blob.size > MAX_UPLOAD_BYTES) blob = await toBlob('image/jpeg', 0.6)
  if (!blob) throw new Error("This image couldn't be processed. Please try another one.")
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('This image is too large even after compressing. Please choose a smaller one.')
  return blob
}

/** Uploads into the uploader's own folder (enforced by storage policies). Returns the public URL. */
export async function uploadImage(userId, file, kind, bucket = IMAGE_BUCKET) {
  const problem = checkImage(file)
  if (problem) throw new Error(problem)
  const blob = await compress(file)
  const ext = TYPES[blob.type] ?? 'jpg'
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${userId}/${kind}-${Date.now()}-${rand}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // file names are unique, so they can be cached for a year
    upsert: false,
  })
  if (error) throw new Error("The image couldn't be uploaded. Please try again.")
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
