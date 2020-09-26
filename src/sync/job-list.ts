import {
  Scuttlebutt,
  ScuttlebuttOptions,
  Update,
  UpdateItems,
  Sources,
  createId,
} from '@jacobbubu/scuttlebutt-pull'
import { randstr, between, lo as lowChar, hi as highChar } from '@jacobbubu/between-ts'
import LRUCache = require('lru-cache')

import {
  JobId,
  validateUpdate,
  makeCreateChange,
  makeSortChange,
  ToJSON,
  JobOptions,
  JobInitial,
  ProgressData,
  ExtraData,
  SortId,
  DoneError,
  DoneResult,
} from '../common'
import { Job } from './job'

import { StoreBase } from './store-base'
import { MemoryStore } from './memory-store'

export interface JobListOptions extends ScuttlebuttOptions {
  store?: StoreBase
  maxItems?: number
}

export type CreateListener = (
  jobId: JobId,
  initial: JobInitial,
  jobList: JobList,
  update: Update
) => void
export type ProgressListener = (
  jobId: JobId,
  progress: ProgressData,
  jobList: JobList,
  update: Update
) => void
export type ExtraListener = (
  jobId: JobId,
  extra: ExtraData,
  jobList: JobList,
  update: Update
) => void
export type SortIdListener = (
  jobId: JobId,
  sortId: SortId,
  jobList: JobList,
  update: Update
) => void
export type DoneListener = (
  jobId: JobId,
  err: DoneError,
  res: DoneResult,
  jobList: JobList,
  update: Update
) => void

export interface JobList {
  addListener(event: 'created' | 'createdByPeer', listener: CreateListener): this
  on(event: 'created' | 'createdByPeer', listener: CreateListener): this
  once(event: 'created' | 'createdByPeer', listener: CreateListener): this
  removeListener(event: 'created' | 'createdByPeer', listener: CreateListener): this
  off(event: 'created' | 'createdByPeer', listener: CreateListener): this
  emit(
    event: 'created' | 'createdByPeer',
    jobId: JobId,
    initial: JobInitial,
    jobList: JobList,
    update: Update
  ): boolean

  addListener(event: 'progress' | 'progressByPeer', listener: ProgressListener): this
  on(event: 'progress' | 'progressByPeer', listener: ProgressListener): this
  once(event: 'progress' | 'progressByPeer', listener: ProgressListener): this
  removeListener(event: 'progress' | 'progressByPeer', listener: ProgressListener): this
  off(event: 'progress' | 'progressByPeer', listener: ProgressListener): this
  emit(
    event: 'progress' | 'progressByPeer',
    jobId: JobId,
    progress: ProgressData,
    jobList: JobList,
    update: Update
  ): boolean

  addListener(event: 'extra' | 'extraByPeer', listener: ExtraListener): this
  on(event: 'extra' | 'extraByPeer', listener: ExtraListener): this
  once(event: 'extra' | 'extraByPeer', listener: ExtraListener): this
  removeListener(event: 'extra' | 'extraByPeer', listener: ExtraListener): this
  off(event: 'extra' | 'extraByPeer', listener: ExtraListener): this
  emit(
    event: 'extra' | 'extraByPeer',
    jobId: JobId,
    extra: ExtraData,
    jobList: JobList,
    update: Update
  ): boolean

  addListener(event: 'sortId' | 'sortIdByPeer', listener: SortIdListener): this
  on(event: 'sortId' | 'sortIdByPeer', listener: SortIdListener): this
  once(event: 'sortId' | 'sortIdByPeer', listener: SortIdListener): this
  removeListener(event: 'sortId' | 'sortIdByPeer', listener: SortIdListener): this
  off(event: 'sortId' | 'sortIdByPeer', listener: SortIdListener): this
  emit(
    event: 'sortId' | 'sortIdByPeer',
    jobId: JobId,
    sortId: SortId,
    jobList: JobList,
    update: Update
  ): boolean

  addListener(event: 'done' | 'doneByPeer', listener: DoneListener): this
  on(event: 'done' | 'doneByPeer', listener: DoneListener): this
  once(event: 'done' | 'doneByPeer', listener: DoneListener): this
  removeListener(event: 'done' | 'doneByPeer', listener: DoneListener): this
  off(event: 'done' | 'doneByPeer', listener: DoneListener): this
  emit(
    event: 'done' | 'doneByPeer',
    jobId: JobId,
    err: DoneError,
    res: DoneResult,
    jobList: JobList,
    update: Update
  ): boolean

  addListener(event: 'invalid', listener: (err: Error) => void): this
  on(event: 'invalid', listener: (err: Error) => void): this
  once(event: 'invalid', listener: (err: Error) => void): this
  removeListener(event: 'invalid', listener: (err: Error) => void): this
  off(event: 'invalid', listener: (err: Error) => void): this
  emit(event: 'invalid', err: Error): boolean
}

export class JobList extends Scuttlebutt {
  private _store: StoreBase
  private readonly _jobCache: LRUCache<JobId, Job>

  constructor(opts: JobListOptions = {}) {
    super(opts)
    this._store = opts.store ?? new MemoryStore()
    this._store.jobList = this
    this._jobCache = new LRUCache({
      max: opts.maxItems ?? 100,
      dispose: (jobId, job) => {
        this._store.off(jobId, job.updateFired)
      },
    })
  }

  get store() {
    return this._store
  }

  getJob(jobId: JobId, loadIfNotExist = true) {
    let job = this._jobCache.get(jobId)
    if (!job && loadIfNotExist) {
      const updates = this._store.getUpdatesById(jobId)
      if (updates.length === 0) return undefined

      job = new Job(this, jobId)
      job.loadUpdates(updates)
      this._store.on(jobId, job.updateFired)
      this._jobCache.set(jobId, job)
    }
    return job
  }

  applyUpdate(update: Update) {
    let result = false
    let message: string
    if (!validateUpdate(update)) {
      message = `invalid update: ${JSON.stringify(update)}`
      this.logger.warn(message)
      this.emit('invalid', new Error(message))
      return false
    }

    const [jobId, [cmd, ...rest]] = update[UpdateItems.Data]
    const sourceId = update[UpdateItems.SourceId]
    const jobOrUpdate = this.getJob(jobId) || this._store.getCreateUpdateById(jobId)

    if (jobOrUpdate) {
      switch (cmd) {
        case 'create':
          message = `the 'create' method is not supported after the job created: new: ${JSON.stringify(
            update
          )}, old: ${JSON.stringify(
            jobOrUpdate instanceof Job ? jobOrUpdate.getInitialUpdate() : jobOrUpdate
          )}`
          this.logger.warn(message)
          this.emit('invalid', new Error(message))
          return false
        case 'progress':
          result = this._store.update(update)
          if (result) {
            const [progress] = rest
            this.emit('progress', jobId, progress, this, update)
            if (this.id !== sourceId) {
              this.emit('progressByPeer', jobId, progress, this, update)
            }
          }
          break
        case 'extra':
          result = this._store.update(update)
          if (result) {
            const [extra] = rest
            this.emit('extra', jobId, extra, this, update)
            if (this.id !== sourceId) {
              this.emit('extraByPeer', jobId, extra, this, update)
            }
          }
          break
        case 'sortId':
          result = this._store.update(update)
          if (result) {
            const [sortId] = rest
            this.emit('sortId', jobId, sortId, this, update)
            if (this.id !== sourceId) {
              this.emit('sortIdByPeer', jobId, sortId, this, update)
            }
          }
          break
        case 'done':
          result = this._store.update(update)
          if (result) {
            const [err, res] = rest
            this.emit('done', jobId, err, res, this, update)
            if (this.id !== sourceId) {
              this.emit('doneByPeer', jobId, err, res, this, update)
            }
          }
          break
        default:
          message = `invalid command: ${JSON.stringify(update)}`
          this.logger.warn(message)
          this.emit('invalid', new Error(message))
      }
    } else {
      if (cmd !== 'create') {
        message = `the ${cmd} method is not supported before job created: ${JSON.stringify(update)}`
        this.logger.warn(message)
        this.emit('invalid', new Error(message))
        return false
      }
      result = this._store.update(update)
      if (result) {
        const [_, initial] = rest
        this.emit('created', jobId, initial, this, update)
        if (this.id !== sourceId) {
          this.emit('createdByPeer', jobId, initial, this, update)
        }
      }
    }
    return result
  }

  history(sources: Sources) {
    return this._store.getHistory(sources)
  }

  insert(job: Job, before?: Job, after?: Job) {
    const beforeSortId = before ? before.getSortId() : lowChar
    const afterSortId = after ? after.getSortId() : highChar

    const _sort = between(beforeSortId, afterSortId) + randstr(3)
    this.localUpdate(makeSortChange(job.id, _sort))
  }

  create(opts: Partial<JobOptions> = {}) {
    const jobId = opts.id ?? createId()
    const last = this._store.lastSortId()

    const sortId = between(last, highChar) + randstr(3)
    this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return this.getJob(jobId)!
  }

  createBefore(before: Job, opts: Partial<JobOptions> = {}) {
    const beforeSortId = before.getSortId()
    const jobId = opts.id ?? createId()
    const prev = this._store.prevSortId(beforeSortId) ?? lowChar

    const sortId = between(prev, beforeSortId) + randstr(3)
    this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return this.getJob(jobId)!
  }

  createAfter(after: Job, opts: Partial<JobOptions> = {}) {
    const afterSortId = after.getSortId()
    const jobId = opts.id ?? createId()
    const next = this._store.nextSortId(afterSortId) ?? highChar

    const sortId = between(afterSortId, next) + randstr(3)
    this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return this.getJob(jobId)!
  }

  getLength() {
    return this._store.length()
  }

  at(index: number) {
    const jobId = this._store.at(index)
    if (!jobId) return undefined

    return this.getJob(jobId)
  }

  toJSON(): ToJSON[] {
    const result: ToJSON[] = []
    for (let i = 0; i < this.getLength(); i++) {
      result.push(this.at(i)!.toJSON())
    }
    return result
  }
}
