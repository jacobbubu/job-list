import {
  AsyncScuttlebutt,
  ScuttlebuttOptions,
  Update,
  UpdateItems,
  Sources,
  createId,
} from '@jacobbubu/scuttlebutt-pull'
import { randstr, between, lo as lowChar, hi as highChar } from '@jacobbubu/between-ts'

import { validateUpdate, makeCreateChange, makeSortChange, ToJSON, JobOptions } from '../common'
import { AsyncJob } from './async-job'

import { AsyncStoreBase } from './async-store-base'
import { SQLiteStore } from './sqlite-store'

export interface AsyncJobListOptions extends ScuttlebuttOptions {
  store?: AsyncStoreBase
}

export class AsyncJobList extends AsyncScuttlebutt {
  private _store: AsyncStoreBase

  constructor(opts: AsyncJobListOptions = {}) {
    super(opts)
    this._store = opts.store ?? new SQLiteStore({ filename: ':memory:' }, 'JobList')
    this._store.jobList = this
  }

  get store() {
    return this._store
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
    const currJob = await this._store.getJob(jobId)

    if (currJob) {
      switch (cmd) {
        case 'create':
          message = `the 'create' method is not supported after the job created: new: ${JSON.stringify(
            update
          )}, old: ${JSON.stringify(currJob.getInitialUpdate())}`
          this.logger.warn(message)
          this.emit('invalid', new Error(message))
          return false
        case 'progress':
          result = await this._store.update(update)
          if (result) {
            this.emit('progress', currJob, rest[0], update)
            if (this.id !== sourceId) {
              this.emit('progressByPeer', currJob, rest[0], update)
            }
          }
          break
        case 'extra':
          result = await this._store.update(update)
          if (result) {
            this.emit('extra', currJob, rest[0], update)
            if (this.id !== sourceId) {
              this.emit('extraByPeer', currJob, rest[0], update)
            }
          }
          break
        case 'sortId':
          result = await this._store.update(update)
          if (result) {
            const sortId = rest[0]
            this.emit('sortId', currJob, sortId, update)
            if (this.id !== sourceId) {
              this.emit('sortIdByPeer', currJob, sortId, update)
            }
          }
          break
        case 'done':
          result = await this._store.update(update)
          if (result) {
            const [err, res] = rest
            this.emit('done', currJob, err, result, update)
            if (this.id !== sourceId) {
              this.emit('doneByPeer', currJob, err, res, update)
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
        const newJob = await this._store.getJob(jobId)
        this.emit('created', newJob, update)
        if (this.id !== sourceId) {
          this.emit('createdByPeer', newJob, update)
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

    return (await this.store.getJob(jobId))!
  }

  async createBefore(before: AsyncJob, opts: Partial<JobOptions> = {}): Promise<AsyncJob> {
    const beforeSortId = before.getSortId()
    const jobId = opts.id ?? createId()
    const prev = (await this._store.prevSortId(beforeSortId)) ?? lowChar

    const sortId = between(prev, beforeSortId) + randstr(3)
    await this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    const newJob = (await this.store.getJob(jobId))!
    return newJob
  }

  async createAfter(after: AsyncJob, opts: Partial<JobOptions> = {}): Promise<AsyncJob> {
    const afterSortId = after.getSortId()
    const jobId = opts.id ?? createId()
    const next = (await this._store.nextSortId(afterSortId)) ?? highChar

    const sortId = between(afterSortId, next) + randstr(3)
    await this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return (await this.store.getJob(jobId))!
  }

  async getLength() {
    return this._store.getLength()
  }

  async at(index: number) {
    const jobId = await this._store.at(index)
    if (!jobId) return undefined

    return this.store.getJob(jobId)
  }

  async toJSON(): Promise<ToJSON[]> {
    const result: ToJSON[] = []
    for (let i = 0; i < (await this.getLength()); i++) {
      result.push((await this.at(i))!.toJSON())
    }
    return result
  }
}
