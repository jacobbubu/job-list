import { Update, UpdateItems } from '@jacobbubu/scuttlebutt-pull'
import { hi as hiChar } from '@jacobbubu/between-ts'

import {
  DoneError,
  DoneResult,
  ToJSON,
  JobId,
  makeProgressChange,
  makeExtraChange,
  makeDoneChange,
  ProgressData,
  ExtraData,
  SortId,
  JobInitial,
  JobListUpdateItems,
  JobListCmdItems,
} from '../common'
import { JobBase } from '../sync'
import { AsyncJobList } from './async-job-list'

export class AsyncJob extends JobBase {
  private _initialUpdate: Update | undefined = undefined
  private readonly _progressUpdates: Update[] = []
  private readonly _extraUpdates: Update[] = []
  private _sortIdUpdate: Update | undefined
  private _resultUpdate: Update | undefined = undefined

  private _initial: JobInitial | undefined = undefined
  private readonly _progress: ProgressData[] = []
  private readonly _extra: ExtraData[] = []
  private _sortId: SortId = hiChar
  private _result: [DoneError, DoneResult] | undefined = undefined

  constructor(private readonly _jobList: AsyncJobList, id: JobId) {
    super(id)
    this.updateFired = this.updateFired.bind(this)
  }

  get jobList() {
    return this._jobList
  }

  async progress(data: any) {
    if (this._finished) {
      throw new Error('the progress method cannot be called after the job ends')
    }
    return this.jobList.localUpdate(makeProgressChange(this.id, data))
  }

  async done(err: DoneError, result?: DoneResult) {
    if (this._finished) {
      throw new Error('the done method cannot be called after the job ends')
    }
    const res = await this.jobList.localUpdate(makeDoneChange(this.id, err, result ?? null))
    if (res) {
      this._finished = true
    }
    return res
  }

  async extra(data: any) {
    return this.jobList.localUpdate(makeExtraChange(this.id, data))
  }

  getInitialUpdate() {
    return this._initialUpdate
  }

  getProgressUpdates() {
    return this._progressUpdates
  }

  getExtraUpdates() {
    return this._extraUpdates
  }

  getSortIdUpdate() {
    return this._sortIdUpdate
  }

  getResultUpdate() {
    return this._resultUpdate
  }

  getInitial() {
    return this._initial
  }

  getProgress() {
    return this._progress
  }

  getExtra() {
    return this._extra
  }

  getSortId() {
    return this._sortId
  }

  getResult() {
    return this._result
  }

  updateFired(update: Update) {
    const payload = update[UpdateItems.Data][JobListUpdateItems.Payload]
    const cmd = payload[JobListCmdItems.Cmd]
    switch (cmd) {
      case 'create':
        this._initialUpdate = update
        this._sortId = payload[JobListCmdItems.SortId]
        this._initial = payload[JobListCmdItems.Initial]
        break
      case 'progress':
        this._progressUpdates.push(update)
        this._progress.push(payload[JobListCmdItems.Progress])
        break
      case 'extra':
        this._extraUpdates.push(update)
        this._extra.push(payload[JobListCmdItems.Extra])
        break
      case 'sortId':
        this._sortIdUpdate = update
        this._sortId = payload[JobListCmdItems.SortId]
        break
      case 'done':
        this._resultUpdate = update
        this._result = [payload[JobListCmdItems.DoneErr], payload[JobListCmdItems.DoneRes]]
        break
    }
  }

  loadUpdates(updates: Update[]) {
    for (let i = 0; i < updates.length; i++) {
      this.updateFired(updates[i])
    }
  }

  toJSON(): ToJSON {
    return {
      id: this.id,
      initial: this._initial,
      progress: this._progress,
      extra: this._extra,
      sortId: this._sortId,
      result: this._result,
    }
  }
}
