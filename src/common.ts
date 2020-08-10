import { Update, UpdateItems } from '@jacobbubu/scuttlebutt-pull'
export type JobId = string
export type JobInitial = any
export type ProgressData = any
export type DoneError = Error | string | null
export type DoneResult = any
export type ExtraData = any
export type SortId = string

export type CreateChange = [JobId, ['create', SortId, JobInitial]]
export type ProgressChange = [JobId, ['progress', ProgressData]]
export type ExtraChange = [JobId, ['extra', ExtraData]]
export type SortIdChange = [JobId, ['sortId', SortId]]
export type DoneChange = [JobId, ['done', DoneError, DoneResult]]

export enum JobChangeItems {
  JobId = 0,
  Change = 1,
  Cmd = 0,
  SortId = 1,
}

export enum JobListUpdateItems {
  JobId = 0,
  Payload,
}

export enum JobListCmdItems {
  Cmd = 0,
  Initial = 2,
  Progress = 1,
  Extra = 1,
  SortId = 1,
  DoneErr = 1,
  DoneRes = 2,
}

export interface ToJSON {
  id: JobId
  initial: JobInitial | undefined
  progress: ProgressData[]
  extra: ExtraData[]
  result: [DoneError, DoneResult] | undefined
  sortId: SortId
}

export function makeCreateChange(jobId: JobId, sortId: SortId, initial: JobInitial): CreateChange {
  return [jobId, ['create', sortId, initial]]
}

export function makeSortChange(jobId: JobId, sortId: string): SortIdChange {
  return [jobId, ['sortId', sortId]]
}

export function makeProgressChange(jobId: JobId, data: ProgressData): ProgressChange {
  return [jobId, ['progress', data]]
}

export function makeDoneChange(jobId: JobId, err: DoneError, data: DoneResult): DoneChange {
  return [jobId, ['done', err, data]]
}

export function makeExtraChange(jobId: JobId, data: ExtraData): ExtraChange {
  return [jobId, ['extra', data]]
}

export function validateUpdate(update: Update) {
  const change = update[UpdateItems.Data]
  if (!Array.isArray(change)) return false

  const [jobId, rest] = change
  if ('string' !== typeof jobId || !Array.isArray(rest)) return false

  const [cmd] = rest
  return ['create', 'progress', 'done', 'extra', 'sortId'].includes(cmd)
}

export interface JobOptions {
  id: JobId
  initial: JobInitial
}
