import { link } from '@jacobbubu/scuttlebutt-pull'
import { JobList } from '../src'
import { job1Opts, job2Opts, job3Opts, delay } from './common'

describe('seq', () => {
  it.skip('createBefore', async () => {
    const a = new JobList({ id: 'A' })
    const b = new JobList({ id: 'B' })

    const job1 = a.create(job1Opts)
    const job2 = a.createBefore(job1, job2Opts)

    expect(a.at(0)).toBe(job2)
    expect(a.at(1)).toBe(job1)

    const s1 = a.createStream({ name: 's1' })
    const s2 = b.createStream({ name: 's2' })

    link(s1, s2)

    await delay(10)

    expect(b.at(0)!.id).toBe(job2.id)
    expect(b.at(1)!.id).toBe(job1.id)
  })

  it('createAfter', async () => {
    const a = new JobList({ id: 'A' })
    const b = new JobList({ id: 'B' })

    const job1 = a.create(job1Opts)
    const job3 = a.create(job3Opts)
    const job2 = a.createAfter(job1, job2Opts)

    expect(a.at(0)).toBe(job1)
    expect(a.at(1)).toBe(job2)
    expect(a.at(2)).toBe(job3)

    const s1 = a.createStream({ name: 's1' })
    const s2 = b.createStream({ name: 's2' })
    link(s1, s2)
    await delay(10)

    expect(b.getLength()).toBe(3)
    expect(b.at(0)!.id).toBe(job1.id)
    expect(b.at(1)!.id).toBe(job2.id)
    expect(b.at(2)!.id).toBe(job3.id)

    // move the third item between the first and second items
    b.insert(b.at(2)!, b.at(0), b.at(1))
    expect(b.at(0)!.id).toBe(job1.id)
    expect(b.at(2)!.id).toBe(job2.id)

    await delay(10)

    expect(a.at(0)).toBe(job1)
    expect(a.at(1)).toBe(job3)
    expect(a.at(2)).toBe(job2)
  })
})
