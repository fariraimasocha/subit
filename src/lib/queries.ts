import { queryOptions, useQuery } from '@tanstack/react-query'
import { getConfig, getProjectFn, listProjectsFn } from '~/server/api.ts'

/** Explicit, structured query keys so mutations can invalidate precisely. */
export const qk = {
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  job: (jobId: string) => ['job', jobId] as const,
  config: ['config'] as const,
}

export const configQuery = () =>
  queryOptions({ queryKey: qk.config, queryFn: () => getConfig(), staleTime: Infinity })

/**
 * Every project query needs D1. Firing one before the credentials exist just
 * produces a failed request whose only useful content is "D1 is not
 * configured", which the setup banner already says, so the routes gate on this
 * instead and render setup instructions.
 */
export function useConfig() {
  const { data } = useQuery(configQuery())
  return { config: data, ready: data?.d1 === true, known: data !== undefined }
}

export const projectsQuery = (enabled = true) =>
  queryOptions({
    queryKey: qk.projects,
    queryFn: () => listProjectsFn(),
    enabled,
  })

export const projectQuery = (id: string, enabled = true) =>
  queryOptions({
    queryKey: qk.project(id),
    queryFn: () => getProjectFn({ data: { id } }),
    enabled,
    // A project sitting in `processing` is waiting on a detached ingest job, so
    // poll until it settles. Everything else is static until the user edits it.
    refetchInterval: (q) =>
      q.state.data?.status === 'processing' || q.state.data?.status === 'uploaded' ? 2000 : false,
  })
