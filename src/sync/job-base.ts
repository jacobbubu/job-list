import { JobId } from '../common'

export class JobBase {
  protected readonly _id: JobId
  protected _finished: boolean = false

  constructor(id: JobId) {
    this._id = id
  }

  get id() {
    return this._id
  }

  get finished() {
    return this._finished
  }
}
