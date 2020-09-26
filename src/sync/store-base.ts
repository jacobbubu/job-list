import { EventEmitter } from 'events'
import { Sources, Update } from '@jacobbubu/scuttlebutt-pull'
import { hi as highChar, lo as lowChar } from '@jacobbubu/between-ts'
import { JobId, SortId } from '../common'
import { JobList } from './job-list'

export class StoreBase extends EventEmitter {
  private _jobList: JobList | undefined = undefined

  get jobList() {
    return this._jobList!
  }

  set jobList(jobList: JobList) {
    this._jobList = jobList
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

  getCreateUpdateById(id: JobId): Update | undefined {
    return undefined
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

  delete(id: JobId | JobId[]): JobId[] {
    return []
  }
}
