import { link } from '@jacobbubu/scuttlebutt-pull'
import { JobList } from '../src'
import { job1Opts, delay } from './common'

describe('sync', () => {
  it('create/progress/extra/done', async () => {
    const createdByPeer = jest.fn()
    const progressByPeer = jest.fn()
    const extraByPeer = jest.fn()
    const doneByPeer = jest.fn()

    const a = new JobList({ id: 'A' })
    const b = new JobList({ id: 'B' })

    b.on('createdByPeer', createdByPeer)
    b.on('progressByPeer', progressByPeer)
    b.on('extraByPeer', extraByPeer)
    b.on('doneByPeer', doneByPeer)

    const aJob = a.create(job1Opts)

    const s1 = a.createStream({ name: 's1' })
    const s2 = b.createStream({ name: 's2' })

    link(s1, s2)

    await delay(10)

    aJob.progress('10%')
    aJob.done(null, 'DONE-1')
    aJob.extra('EXTRA-1')

    expect(createdByPeer).toHaveBeenCalledTimes(1)
    const paramsOfCreated = createdByPeer.mock.calls[0]
    expect(paramsOfCreated[0].toJSON()).toEqual(aJob.toJSON())

    expect(progressByPeer).toHaveBeenCalledTimes(1)
    const paramsOfProgress = progressByPeer.mock.calls[0]
    expect(paramsOfProgress[0].toJSON()).toEqual(aJob.toJSON())
    expect(paramsOfProgress[1]).toBe('10%')

    expect(extraByPeer).toHaveBeenCalledTimes(1)
    const paramsOfExtra = extraByPeer.mock.calls[0]
    expect(paramsOfExtra[0].toJSON()).toEqual(aJob.toJSON())
    expect(paramsOfExtra[1]).toBe('EXTRA-1')

    expect(doneByPeer).toHaveBeenCalledTimes(1)
    const paramsOfDone = doneByPeer.mock.calls[0]
    expect(paramsOfExtra[0].toJSON()).toEqual(aJob.toJSON())
    expect(paramsOfDone[1]).toBe(null)
    expect(paramsOfDone[2]).toBe('DONE-1')
  })
})
