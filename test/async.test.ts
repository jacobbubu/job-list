import { link, UpdateItems } from '@jacobbubu/scuttlebutt-pull'
import { job1Opts, delay, tableName } from './common'
import { AsyncJobList, AsyncJob, JobListUpdateItems, JobListCmdItems, SQLiteStore } from '../src'

async function confirmEvent(cmd: string, params: any[], job: AsyncJob) {
  const jobId = params[0]
  const data1 = params[1]
  const data2 = cmd !== 'done' ? undefined : params[2]
  const jobList = cmd !== 'done' ? params[2] : params[3]
  const update = cmd !== 'done' ? params[3] : params[4]
  const change = update[UpdateItems.Data]
  expect(change[JobListUpdateItems.JobId]).toBe(jobId)
  const payload = change[JobListUpdateItems.Payload]
  if (cmd === 'create') {
    expect(payload[JobListCmdItems.Initial]).toBe(data1)
  } else {
    expect(payload[1]).toBe(data1)
  }
  if (cmd === 'done') {
    expect(payload[JobListCmdItems.DoneRes]).toBe(data2)
  }
  expect((await jobList.getJob(jobId))?.toJSON()).toEqual(job.toJSON())
}

describe('async', () => {
  it('create/progress/extra/done', async () => {
    const createdByPeer = jest.fn()
    const progressByPeer = jest.fn()
    const extraByPeer = jest.fn()
    const doneByPeer = jest.fn()

    const a = new AsyncJobList({
      id: 'A',
      store: new SQLiteStore({ filename: ':memory:' }, tableName),
    })
    const b = new AsyncJobList({
      id: 'B',
      store: new SQLiteStore({ filename: ':memory:' }, tableName),
    })

    b.on('createdByPeer', createdByPeer)
    b.on('progressByPeer', progressByPeer)
    b.on('extraByPeer', extraByPeer)
    b.on('doneByPeer', doneByPeer)

    const aJob = await a.create(job1Opts)

    const s1 = a.createStream({ name: 's1' })
    const s2 = b.createStream({ name: 's2' })

    link(s1, s2)

    await delay(50)

    await aJob.progress('10%')
    await aJob.done(null, 'DONE-1')
    await aJob.extra('EXTRA-1')

    await delay(50)

    expect(createdByPeer).toHaveBeenCalledTimes(1)
    const paramsOfCreated = createdByPeer.mock.calls[0]
    await confirmEvent('create', paramsOfCreated, aJob)

    expect(progressByPeer).toHaveBeenCalledTimes(1)
    const paramsOfProgress = progressByPeer.mock.calls[0]
    await confirmEvent('progress', paramsOfProgress, aJob)

    expect(extraByPeer).toHaveBeenCalledTimes(1)
    const paramsOfExtra = extraByPeer.mock.calls[0]
    await confirmEvent('extra', paramsOfExtra, aJob)

    expect(doneByPeer).toHaveBeenCalledTimes(1)
    const paramsOfDone = doneByPeer.mock.calls[0]
    await confirmEvent('done', paramsOfDone, aJob)

    expect(await a.toJSON()).toEqual(await b.toJSON())
  })
})
