import {
  Scuttlebutt,
  ScuttlebuttOptions,
  Update,
  UpdateItems,
  Sources,
  createId,
} from '@jacobbubu/scuttlebutt-pull'
import { randstr, between, lo as lowChar, hi as highChar } from '@jacobbubu/between-ts'

import { validateUpdate, makeCreateChange, makeSortChange, ToJSON, JobOptions } from '../common'
import { Job } from './job'

import { StoreBase } from './store-base'
import { MemoryStore } from './memory-store'

export interface JobListOptions extends ScuttlebuttOptions {
  store?: StoreBase
}

export class JobList extends Scuttlebutt {
  private _store: StoreBase

  constructor(opts: JobListOptions = {}) {
    super(opts)
    this._store = opts.store ?? new MemoryStore()
    this._store.jobList = this
  }

  get store() {
    return this._store
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
    const currJob = this._store.getJob(jobId)

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
          result = this._store.update(update)
          if (result) {
            this.emit('progress', currJob, rest[0], update)
            if (this.id !== sourceId) {
              this.emit('progressByPeer', currJob, rest[0], update)
            }
          }
          break
        case 'extra':
          result = this._store.update(update)
          if (result) {
            this.emit('extra', currJob, rest[0], update)
            if (this.id !== sourceId) {
              this.emit('extraByPeer', currJob, rest[0], update)
            }
          }
          break
        case 'sortId':
          result = this._store.update(update)
          if (result) {
            const sortId = rest[0]
            this.emit('sortId', currJob, sortId, update)
            if (this.id !== sourceId) {
              this.emit('sortIdByPeer', currJob, sortId, update)
            }
          }
          break
        case 'done':
          result = this._store.update(update)
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
      result = this._store.update(update)
      if (result) {
        const newJob = this._store.getJob(jobId)
        this.emit('created', newJob, update)
        if (this.id !== sourceId) {
          this.emit('createdByPeer', newJob, update)
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

    return this.store.getJob(jobId)!
  }

  createBefore(before: Job, opts: Partial<JobOptions> = {}) {
    const beforeSortId = before.getSortId()
    const jobId = opts.id ?? createId()
    const prev = this._store.prevSortId(beforeSortId) ?? lowChar

    const sortId = between(prev, beforeSortId) + randstr(3)
    this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return this.store.getJob(jobId)!
  }

  createAfter(after: Job, opts: Partial<JobOptions> = {}) {
    const afterSortId = after.getSortId()
    const jobId = opts.id ?? createId()
    const next = this._store.nextSortId(afterSortId) ?? highChar

    const sortId = between(afterSortId, next) + randstr(3)
    this.localUpdate(makeCreateChange(jobId, sortId, opts.initial))

    return this.store.getJob(jobId)!
  }

  getLength() {
    return this._store.length()
  }

  at(index: number) {
    const jobId = this._store.at(index)
    if (!jobId) return undefined

    return this.store.getJob(jobId)
  }

  toJSON(): ToJSON[] {
    const result: ToJSON[] = []
    for (let i = 0; i < this.getLength(); i++) {
      result.push(this.at(i)!.toJSON())
    }
    return result
  }
}
