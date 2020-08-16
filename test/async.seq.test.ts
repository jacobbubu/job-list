import { link } from '@jacobbubu/scuttlebutt-pull'
import { AsyncJobList } from '../src'
import { job1Opts, job2Opts, job3Opts, delay } from './common'

describe('seq', () => {
  it('createBefore', async () => {
    const a = new AsyncJobList({ id: 'A' })
    const b = new AsyncJobList({ id: 'B' })

    const job1 = await a.create(job1Opts)
    const job2 = await a.createBefore(job1, job2Opts)

    expect(await a.at(0)).toBe(job2)
    expect(await a.at(1)).toBe(job1)

    const s1 = a.createStream({ name: 's1' })
    const s2 = b.createStream({ name: 's2' })

    link(s1, s2)

    await delay(50)

    expect((await b.at(0))!.id).toBe(job2.id)
    expect((await b.at(1))!.id).toBe(job1.id)
  })

  it('createAfter', async () => {
    const a = new AsyncJobList({ id: 'A' })
    const b = new AsyncJobList({ id: 'B' })

    const job1 = await a.create(job1Opts)
    const job3 = await a.create(job3Opts)
    const job2 = await a.createAfter(job1, job2Opts)

    expect(await a.at(0)).toBe(job1)
    expect(await a.at(1)).toBe(job2)
    expect(await a.at(2)).toBe(job3)

    const s1 = a.createStream({ name: 's1' })
    const s2 = b.createStream({ name: 's2' })
    link(s1, s2)
    await delay(50)

    expect(await b.getLength()).toBe(3)
    expect((await b.at(0))!.id).toBe(job1.id)
    expect((await b.at(1))!.id).toBe(job2.id)
    expect((await b.at(2))!.id).toBe(job3.id)

    // move the third item between the first and second items
    await b.insert((await b.at(2))!, (await b.at(0))!, (await b.at(1))!)
    expect((await b.at(0))!.id).toBe(job1.id)
    expect((await b.at(1))!.id).toBe(job3.id)

    await delay(50)

    expect(await a.at(0)).toBe(job1)
    expect(await a.at(1)).toBe(job3)
    expect(await a.at(2)).toBe(job2)
  })
})
