import { EventEmitter } from 'events'
import { Sources, Update } from '@jacobbubu/scuttlebutt-pull'
import { hi as highChar, lo as lowChar } from '@jacobbubu/between-ts'
import { JobId, SortId } from '../common'
import { AsyncJobList } from './async-job-list'
import { AsyncJob } from './async-job'

export class AsyncStoreBase extends EventEmitter {
  private _jobList: AsyncJobList | undefined = undefined

  get jobList() {
    return this._jobList!
  }

  set jobList(jobList: AsyncJobList) {
    this._jobList = jobList
  }

  async init() {
    return
  }

  async tearOff() {
    return
  }

  async getUpdatesById(id: JobId): Promise<Update[]> {
    return []
  }

  async getCreateUpdateById(id: JobId): Promise<Update | undefined> {
    return undefined
  }

  async update(update: Update): Promise<boolean> {
    return false
  }

  async getHistory(sources: Sources): Promise<Update[]> {
    return []
  }

  async lastSortId(): Promise<SortId | undefined> {
    return undefined
  }

  async prevSortId(target: SortId = highChar): Promise<SortId | undefined> {
    return undefined
  }

  async nextSortId(target: SortId = lowChar): Promise<SortId | undefined> {
    return undefined
  }

  async getLength(): Promise<number> {
    return 0
  }

  async at(index: number): Promise<SortId | undefined> {
    return undefined
  }
}
