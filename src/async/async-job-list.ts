import {
  AsyncScuttlebutt,
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
import { AsyncJob } from './async-job'

import { AsyncStoreBase } from './async-store-base'
import { SQLiteStore } from './sqlite-store'

export interface AsyncJobListOptions extends ScuttlebuttOptions {
  store?: AsyncStoreBase
  maxItems?: number
}

export type AsyncCreateListener = (
  jobId: JobId,
  initial: JobInitial,
  jobList: AsyncJobList,
  update: Update
) => void

export type AsyncProgressListener = (
  jobId: JobId,
  progress: ProgressData,
  jobList: AsyncJobList,
  update: Update
) => void

export type AsyncExtraListener = (
  jobId: JobId,
  extra: ExtraData,
  jobList: AsyncJobList,
  update: Update
) => void
export type AsyncSortIdListener = (
  jobId: JobId,
  sortId: SortId,
  jobList: AsyncJobList,
  update: Update
) => void

export type AsyncDoneListener = (
  jobId: JobId,
  err: DoneError,
  res: DoneResult,
  jobList: AsyncJobList,
  update: Update
) => void

export interface AsyncJobList {
  addListener(event: 'created' | 'createdByPeer', listener: AsyncCreateListener): this
  on(event: 'created' | 'createdByPeer', listener: AsyncCreateListener): this
  once(event: 'created' | 'createdByPeer', listener: AsyncCreateListener): this
  removeListener(event: 'created' | 'createdByPeer', listener: AsyncCreateListener): this
  off(event: 'created' | 'createdByPeer', listener: AsyncCreateListener): this
  emit(
    event: 'created' | 'createdByPeer',
    jobId: JobId,
    initial: JobInitial,
    jobList: AsyncJobList,
    update: Update
  ): boolean

  addListener(event: 'progress' | 'progressByPeer', listener: AsyncProgressListener): this
  on(event: 'progress' | 'progressByPeer', listener: AsyncProgressListener): this
  once(event: 'progress' | 'progressByPeer', listener: AsyncProgressListener): this
  removeListener(event: 'progress' | 'progressByPeer', listener: AsyncProgressListener): this
  off(event: 'progress' | 'progressByPeer', listener: AsyncProgressListener): this
  emit(
    event: 'progress' | 'progressByPeer',
    jobId: JobId,
    progress: ProgressData,
    jobList: AsyncJobList,
    update: Update
  ): boolean

  addListener(event: 'extra' | 'extraByPeer', listener: AsyncExtraListener): this
  on(event: 'extra' | 'extraByPeer', listener: AsyncExtraListener): this
  once(event: 'extra' | 'extraByPeer', listener: AsyncExtraListener): this
  removeListener(event: 'extra' | 'extraByPeer', listener: AsyncExtraListener): this
  off(event: 'extra' | 'extraByPeer', listener: AsyncExtraListener): this
  emit(
    event: 'extra' | 'extraByPeer',
    jobId: JobId,
    extra: ExtraData,
    jobList: AsyncJobList,
    update: Update
  ): boolean

  addListener(event: 'sortId' | 'sortIdByPeer', listener: AsyncSortIdListener): this
  on(event: 'sortId' | 'sortIdByPeer', listener: AsyncSortIdListener): this
  once(event: 'sortId' | 'sortIdByPeer', listener: AsyncSortIdListener): this
  removeListener(event: 'sortId' | 'sortIdByPeer', listener: AsyncSortIdListener): this
  off(event: 'sortId' | 'sortIdByPeer', listener: AsyncSortIdListener): this
  emit(
    event: 'sortId' | 'sortIdByPeer',
    jobId: JobId,
    sortId: SortId,
    jobList: AsyncJobList,
    update: Update
  ): boolean

  addListener(event: 'done' | 'doneByPeer', listener: AsyncDoneListener): this
  on(event: 'done' | 'doneByPeer', listener: AsyncDoneListener): this
  once(event: 'done' | 'doneByPeer', listener: AsyncDoneListener): this
  removeListener(event: 'done' | 'doneByPeer', listener: AsyncDoneListener): this
  off(event: 'done' | 'doneByPeer', listener: AsyncDoneListener): this
  emit(
    event: 'done' | 'doneByPeer',
    jobId: JobId,
    err: DoneError,
    res: DoneResult,
    jobList: AsyncJobList,
    update: Update
  ): boolean

  addListener(event: 'invalid', listener: (err: Error) => void): this
  on(event: 'invalid', listener: (err: Error) => void): this
  once(event: 'invalid', listener: (err: Error) => void): this
  removeListener(event: 'invalid', listener: (err: Error) => void): this
  off(event: 'invalid', listener: (err: Error) => void): this
  emit(event: 'invalid', err: Error): boolean
}

export class AsyncJobList extends AsyncScuttlebutt {
  private _store: AsyncStoreBase
  private readonly _jobCache: LRUCache<JobId, AsyncJob>

  constructor(opts: AsyncJobListOptions = {}) {
    super(opts)
    this._store = opts.store ?? new SQLiteStore({ filename: ':memory:' }, 'AsyncJobList')
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

  async getJob(jobId: JobId, loadIfNotExist = true) {
    let job = this._jobCache.get(jobId)
    if (!job && loadIfNotExist) {
      const updates = await this._store.getUpdatesById(jobId)
      if (updates.length === 0) return undefined

      job = new AsyncJob(this, jobId)
      job.loadUpdates(updates)
      this._store.on(jobId, job.updateFired)
      this._jobCache.set(jobId, job)
    }
    return job
  }

  async applyUpdate(update: Update) {
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
    const jobOrUpdate = (await this.getJob(jobId)) || (await this._store.getCreateUpdateById(jobId))

    if (jobOrUpdate) {
      switch (cmd) {
        case 'create':
          message = `the 'create' method is not supported after the job created: new: ${JSON.stringify(
            update
          )}, old: ${JSON.stringify(
            jobOrUpdate instanceof AsyncJob ? jobOrUpdate.getInitialUpdate() : jobOrUpdate
          )}`
          this.logger.warn(message)
          this.emit('invalid', new Error(message))
          return false
        case 'progress':
          result = await this._store.update(update)
          if (result) {
            const [progress] = rest
            this.emit('progress', jobId, progress, this, update)
            if (this.id !== sourceId) {
              this.emit('progressByPeer', jobId, progress, this, update)
            }
          }
          break
        case 'extra':
          result = await this._store.update(update)
          if (result) {
            const [extra] = rest
            this.emit('extra', jobId, extra, this, update)
            if (this.id !== sourceId) {
              this.emit('extraByPeer', jobId, extra, this, update)
            }
          }
          break
        case 'sortId':
          result = await this._store.update(update)
          if (result) {
            const [sortId] = rest
            this.emit('sortId', jobId, sortId, this, update)
            if (this.id !== sourceId) {
              this.emit('sortIdByPeer', jobId, sortId, this, update)
            }
          }
          break
        case 'done':
          result = await this._store.update(update)
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
      result = await this._store.update(update)
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

  async history(sources: Sources) {
    const hist = await this._store.getHistory(sources)
    return hist
  }

  async insert(job: AsyncJob, before?: AsyncJob, after?: AsyncJob) {
    const beforeSortId = before ? before.getSortId() : lowChar
    const afterSortId = after ? after.getSortId() : highChar

    const _sort = between(beforeSortId, afterSortId) + randstr(3)
    await this.localUpdate(makeSortChange(job.id, _sort))
  }

  async create(opts: Partial<JobOptions> = {}): Promise<AsyncJob> {
    const jobId = opts.id ?? createId()
    const last = await this._store.lastSortId()

    const sortId = between(last, highChar) + randstr(3)
    await this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return (await this.getJob(jobId))!
  }

  async createBefore(before: AsyncJob, opts: Partial<JobOptions> = {}): Promise<AsyncJob> {
    const beforeSortId = before.getSortId()
    const jobId = opts.id ?? createId()
    const prev = (await this._store.prevSortId(beforeSortId)) ?? lowChar

    const sortId = between(prev, beforeSortId) + randstr(3)
    await this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return (await this.getJob(jobId))!
  }

  async createAfter(after: AsyncJob, opts: Partial<JobOptions> = {}): Promise<AsyncJob> {
    const afterSortId = after.getSortId()
    const jobId = opts.id ?? createId()
    const next = (await this._store.nextSortId(afterSortId)) ?? highChar

    const sortId = between(afterSortId, next) + randstr(3)
    await this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return (await this.getJob(jobId))!
  }

  async getLength() {
    return this._store.getLength()
  }

  async at(index: number) {
    const jobId = await this._store.at(index)
    if (!jobId) return undefined

    return this.getJob(jobId)
  }

  async toJSON(): Promise<ToJSON[]> {
    const result: ToJSON[] = []
    for (let i = 0; i < (await this.getLength()); i++) {
      result.push((await this.at(i))!.toJSON())
    }
    return result
  }
}
