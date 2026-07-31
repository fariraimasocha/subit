import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportKeyOf } from './r2.server.ts'

/**
 * export_url is stored as either a presigned URL (bucket in the path) or a
 * public one (bucket in the host), and deleting the previous export depends on
 * recovering the key from whichever shape was saved.
 */
test('exportKeyOf handles both URL shapes', () => {
  assert.equal(
    exportKeyOf('https://acct.r2.cloudflarestorage.com/subit/export/abc.mp4?X-Amz-Signature=x'),
    'export/abc.mp4',
  )
  assert.equal(exportKeyOf('https://pub-x.r2.dev/export/abc.mp4'), 'export/abc.mp4')
})

test('exportKeyOf survives a bucket literally named export', () => {
  assert.equal(exportKeyOf('https://acct.r2.cloudflarestorage.com/export/export/abc.mp4'), 'export/abc.mp4')
})

test('exportKeyOf returns null rather than a wrong key', () => {
  assert.equal(exportKeyOf('https://pub-x.r2.dev/norm/abc.mp4'), null)
  assert.equal(exportKeyOf(null), null)
  assert.equal(exportKeyOf('not a url'), null)
})

test('exportKeyOf decodes percent-escaped segments', () => {
  assert.equal(exportKeyOf('https://pub-x.r2.dev/export/a%20b.mp4'), 'export/a b.mp4')
})
