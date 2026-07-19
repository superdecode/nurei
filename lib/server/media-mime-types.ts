/**
 * Single source of truth for which image MIME types the media library accepts.
 * image/svg+xml is intentionally excluded everywhere this is used: SVG can
 * embed <script>/on* handlers, making it a stored-XSS vector if the uploaded
 * file is ever opened directly. Keep both upload paths (direct upload and
 * import-from-URL) reading from this one list so they can't drift apart.
 */
export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

// jpeg/png/webp get recompressed server-side regardless of client flags —
// prevents oversized originals from ever reaching storage (egress cost).
export const COMPRESSIBLE_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
