import { Sources, Update } from '@jacobbubu/scuttlebutt-pull'

import { JobId, SortId } from '../common'
import { hi as highChar, lo as lowChar } from '@jacobbubu/between-ts'
import { JobList } from './job-list'
import { Job } from './job'

export class StoreBase {
  private _jobList: JobList | undefined = undefined

  get jobList() {
    return this._jobList!
  }

  set jobList(jobList: JobList) {
    this._jobList = jobList
  }

  getJob(jobId: JobId, createIfNotExist = false): Job | undefined {
    return undefined
  }

  init(): void {
    return
  }

  tearOff(): void {
    return
  }

  getUpdatesById(id: JobId): Update[] {
    return []
  }

  update(update: Update): boolean {
    return false
  }

  getHistory(sources: Sources): Update[] {
    return []
  }

  lastSortId(): SortId | undefined {
    return undefined
  }

  prevSortId(target: SortId = highChar): SortId | undefined {
    return undefined
  }

  nextSortId(target: SortId = lowChar): SortId | undefined {
    return undefined
  }

  length() {
    return 0
  }

  at(index: number): SortId | undefined {
    return undefined
  }
}
