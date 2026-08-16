import assert from 'node:assert/strict'
import test from 'node:test'
import { dashboardStats } from './dashboard-stats.ts'
import type { Project } from './project.ts'

function project(partial: Partial<Project> & { created_at: number; status: Project['status'] }): Project {
  return {
    id: partial.id ?? 'p',
    name: 'Clip',
    user_id: 'u',
    src_key: 'src',
    norm_key: null,
    norm_url: null,
    poster_url: null,
    width: 1080,
    height: 1920,
    duration: 12,
    cues: [],
    theme: null,
    overlays: [],
    export_url: null,
    error: null,
    stage: null,
    ...partial,
  }
}

test('counts studio status buckets from the project list', () => {
  const now = Date.UTC(2026, 7, 16)
  const stats = dashboardStats(
    [
      project({ id: '1', status: 'ready', created_at: now }),
      project({ id: '2', status: 'done', created_at: now }),
      project({ id: '3', status: 'processing', created_at: now }),
      project({ id: '4', status: 'error', created_at: now }),
    ],
    now,
  )
  assert.equal(stats.total, 4)
  assert.equal(stats.ready, 1)
  assert.equal(stats.exported, 1)
  assert.equal(stats.inFlight, 1)
  assert.equal(stats.failed, 1)
  assert.equal(stats.heatmap.length, 140)
  assert.equal(stats.weekly.length, 12)
})
