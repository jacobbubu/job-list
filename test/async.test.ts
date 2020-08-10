import { link } from '@jacobbubu/scuttlebutt-pull'
import { job1Opts, delay, tableName } from './common'
import { AsyncJobList, AsyncJob, SQLiteStore } from '../src'

async function jobsEqual(job1: AsyncJob, job2: AsyncJob) {
  expect(job1.toJSON()).toEqual(job2.toJSON())
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

    await delay(10)

    await aJob.progress('10%')
    await aJob.done(null, 'DONE-1')
    await aJob.extra('EXTRA-1')

    await delay(10)

    expect(createdByPeer).toHaveBeenCalledTimes(1)
    const paramsOfCreated = createdByPeer.mock.calls[0]
    await jobsEqual(aJob, paramsOfCreated[0])

    expect(progressByPeer).toHaveBeenCalledTimes(1)
    const paramsOfProgress = progressByPeer.mock.calls[0]
    await jobsEqual(aJob, paramsOfProgress[0])
    expect(paramsOfProgress[1]).toBe('10%')

    expect(extraByPeer).toHaveBeenCalledTimes(1)
    const paramsOfExtra = extraByPeer.mock.calls[0]
    await jobsEqual(aJob, paramsOfExtra[0])
    expect(paramsOfExtra[1]).toBe('EXTRA-1')

    expect(doneByPeer).toHaveBeenCalledTimes(1)
    const paramsOfDone = doneByPeer.mock.calls[0]
    await jobsEqual(aJob, paramsOfExtra[0])
    expect(paramsOfDone[1]).toBe(null)
    expect(paramsOfDone[2]).toBe('DONE-1')

    expect(a.toJSON()).toEqual(b.toJSON())
  })
})
