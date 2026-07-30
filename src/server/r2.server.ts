import { AwsClient } from 'aws4fetch'

const endpoint = () => (process.env.CLOUDFLARE_S3_API ?? '').replace(/\/$/, '')
const bucket = () => process.env.R2_BUCKET ?? ''

let client: AwsClient | null = null
function aws() {
  if (!client) {
    client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      service: 's3',
      region: 'auto',
    })
  }
  return client
}

export function r2Configured() {
  return Boolean(
    endpoint() && bucket() && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
  )
}

function assertConfigured() {
  if (!r2Configured()) {
    throw new Error(
      'R2 is not configured. Set CLOUDFLARE_S3_API, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env.local',
    )
  }
}

/**
 * CLOUDFLARE_S3_API is written either as the bare account endpoint or with the
 * bucket already on the end, depending on where in the dashboard it was copied
 * from. Both are accepted; appending the bucket twice is a 404 nobody enjoys
 * debugging.
 */
function objectUrl(key: string) {
  const base = endpoint().endsWith(`/${bucket()}`) ? endpoint() : `${endpoint()}/${bucket()}`
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export function buildKey(scope: string, ext: string) {
  return `${scope}/${crypto.randomUUID()}.${ext.replace(/^\./, '').toLowerCase()}`
}

/**
 * Content-type AND content-length are signed into the query, so R2 itself
 * rejects a mismatched upload. Do not add content-length to the bucket's CORS
 * AllowedHeaders: the browser sets it implicitly and Chrome rejects it as a
 * custom header, while the signature still makes R2 enforce it.
 */
export async function presignPutUrl(key: string, contentType: string, contentLength: number, expires = 3600) {
  assertConfigured()
  const signed = await aws().sign(
    new Request(`${objectUrl(key)}?X-Amz-Expires=${expires}`, {
      method: 'PUT',
      headers: { 'content-type': contentType, 'content-length': String(contentLength) },
    }),
    { aws: { signQuery: true, allHeaders: true } },
  )
  return signed.url
}

export async function presignGetUrl(key: string, expires = 21600) {
  assertConfigured()
  const signed = await aws().sign(new Request(`${objectUrl(key)}?X-Amz-Expires=${expires}`, { method: 'GET' }), {
    aws: { signQuery: true },
  })
  return signed.url
}

export async function putObject(key: string, body: Uint8Array | ArrayBuffer, contentType: string) {
  assertConfigured()
  const res = await aws().fetch(objectUrl(key), {
    method: 'PUT',
    body: body as BodyInit,
    headers: { 'content-type': contentType },
  })
  if (!res.ok) throw new Error(`R2 PUT ${key} failed: ${res.status} ${await res.text()}`)
  return key
}

export async function deleteObject(key: string) {
  assertConfigured()
  const res = await aws().fetch(objectUrl(key), { method: 'DELETE' })
  // 404 means it was never there, which is the state the caller wanted anyway.
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${key} failed: ${res.status}`)
}

/**
 * Public URL if R2_PUBLIC_URL is set, otherwise a long-lived presigned GET.
 * ponytail: no CDN, no cache headers. Ceiling: a custom domain on the bucket.
 */
export async function publicUrl(key: string) {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  if (base) return `${base}/${key}`
  return presignGetUrl(key, 60 * 60 * 24 * 7)
}
