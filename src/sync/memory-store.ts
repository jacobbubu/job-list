import { Update, UpdateItems, Sources, filter } from '@jacobbubu/scuttlebutt-pull'
import { strord, hi as highChar, lo as lowChar } from '@jacobbubu/between-ts'
import bs = require('binary-search')
import LRUCache = require('lru-cache')

import { JobId, SortId, JobListUpdateItems } from '../common'
import { StoreBase } from './store-base'
import { Job } from './job'
import { JobList } from './job-list'

interface SortIdIndexElement {
  jobId: JobId
  sortId: SortId
}

function sortIdIndexComparator(a: SortIdIndexElement, b: SortIdIndexElement) {
  return strord(a.sortId, b.sortId)
}

export interface MemoryStoreOptions {
  maxItems: number
}

export class MemoryStore extends StoreBase {
  private readonly _hist: Update[] = []
  private _sortIdIndex: SortIdIndexElement[] = []
  private readonly _jobCache: LRUCache<JobId, Job>

  constructor(opts: Partial<MemoryStoreOptions> = {}) {
    super()
    this._jobCache = new LRUCache({
      max: opts.maxItems ?? 100,
    })
  }

  getJob(jobId: JobId): Job | undefined {
    let job = this._jobCache.get(jobId)
    if (!job) {
      const updates = this.getUpdatesById(jobId)
      if (updates.length !== 0) {
        job = this.createJob(jobId, updates)
        this._jobCache.set(jobId, job)
        return job
      }
      return undefined
    }
    return job
  }

  init() {
    const coll = this._hist.reduce((sum: Record<string, SortIdIndexElement>, prev) => {
      const [jobId, payload] = prev[UpdateItems.Data]
      const [cmd, sortId] = payload
      switch (cmd) {
        case 'create':
          sum[jobId] = { jobId, sortId }
          break
        case 'sortId':
          sum[jobId] = { jobId, sortId }
          break
      }
      return sum
    }, {})

    this._sortIdIndex = Object.keys(coll)
      .map((key) => coll[key])
      .sort(sortIdIndexComparator)
    return
  }

  getUpdatesById(id: JobId) {
    return this._hist.filter((u) => {
      return u[UpdateItems.Data][JobListUpdateItems.JobId] === id
    })
  }

  update(update: Update) {
    const [jobId, payload] = update[UpdateItems.Data]
    const [cmd, sortId] = payload
    switch (cmd) {
      case 'create':
        const lastSortId = this.lastSortId()
        this._sortIdIndex.push({ jobId, sortId })
        if (lastSortId && strord(sortId, lastSortId) < 0) {
          this._sortIdIndex.sort(sortIdIndexComparator)
        }
        break
      case 'sortId':
        const elem = this._sortIdIndex.find((elem) => elem.jobId === jobId)
        if (elem) {
          elem.sortId = sortId
          this._sortIdIndex.sort(sortIdIndexComparator)
        } else {
          return false
        }
        break
    }
    this._hist.push(update)

    // re-cache when cache missed
    let job = this._jobCache.get(jobId)
    if (!job) {
      job = this.getJob(jobId)
    } else {
      job.updateFired(update)
    }

    return true
  }

  getHistory(sources: Sources) {
    return this._hist.filter((update) => filter(update, sources))
  }

  lastSortId() {
    return this._sortIdIndex[this._sortIdIndex.length - 1]?.sortId
  }

  prevSortId(target: SortId = highChar) {
    return prev(this._sortIdIndex, { jobId: '', sortId: target })
  }

  nextSortId(target: SortId = lowChar) {
    return next(this._sortIdIndex, { jobId: '', sortId: target })
  }

  at(index: number) {
    return this._sortIdIndex[index]?.jobId
  }

  length() {
    return this._sortIdIndex.length
  }

  tearOff() {
    return
  }

  private createJob(jobId: JobId, updates?: Update[]): Job {
    const job = new Job(this, jobId)
    if (updates) {
      job.loadUpdates(updates)
    }
    return job
  }
}

function prev(sortIdIndex: SortIdIndexElement[], target: SortIdIndexElement) {
  let index = bs(sortIdIndex, target, sortIdIndexComparator)
  if (index === 0) {
    return undefined
  } else if (index > 0) {
    index -= 1
    while (index >= 0 && sortIdIndexComparator(sortIdIndex[index], target) === 0) {
      index -= 1
    }
    return index < 0 ? undefined : sortIdIndex[index].sortId
  } else {
    index = Math.abs(index) - 2
    return index < 0 ? undefined : sortIdIndex[index].sortId
  }
}

function next(sortIdIndex: SortIdIndexElement[], target: SortIdIndexElement) {
  let index = bs(sortIdIndex, target, sortIdIndexComparator)
  const length = sortIdIndex.length
  if (index === sortIdIndex.length - 1) {
    return undefined
  } else if (index >= 0) {
    index += 1
    while (index < length && sortIdIndexComparator(sortIdIndex[index], target) === 0) {
      index += 1
    }
    return index >= length ? undefined : sortIdIndex[index].sortId
  } else {
    index = Math.abs(index) - 1
    return index > length ? undefined : sortIdIndex[index].sortId
  }
}
