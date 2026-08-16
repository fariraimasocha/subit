import { appendFileSync } from 'node:fs'

const LOG_PATH = '/Users/fariraimasocha/Documents/running-projects/subit/.cursor/debug-d106a0.log'
const SESSION_LOG_PATH = '/Users/fariraimasocha/Documents/running-projects/subit/.cursor/debug-d8dc48.log'

/** Append one NDJSON line for this debug session. Server-side only. */
export function agentLog(payload: Record<string, unknown>) {
  try {
    appendFileSync(
      LOG_PATH,
      `${JSON.stringify({ sessionId: 'd106a0', ...payload, timestamp: Date.now() })}\n`,
    )
  } catch {
    // Best effort during local debugging.
  }
}

const AUTH_LOG_PATH = '/Users/fariraimasocha/Documents/running-projects/subit/.cursor/debug-aa72d7.log'

/** Session aa72d7: dashboard freeze after login. */
export function agentLogAuth(payload: Record<string, unknown>) {
  try {
    appendFileSync(
      AUTH_LOG_PATH,
      `${JSON.stringify({ sessionId: 'aa72d7', timestamp: Date.now(), ...payload })}\n`,
    )
  } catch {
    // Best effort during local debugging.
  }
}

/** Session d8dc48: delete-modal empty button. */
export function agentLogD8(payload: Record<string, unknown>) {
  try {
    appendFileSync(
      SESSION_LOG_PATH,
      `${JSON.stringify({ sessionId: 'd8dc48', timestamp: Date.now(), ...payload })}\n`,
    )
  } catch {
    // Best effort during local debugging.
  }
}
