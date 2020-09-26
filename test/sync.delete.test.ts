import { JobList } from '../src'
import { job1Opts, job2Opts, job3Opts } from './common'

const extractInitial = (arr: Record<string, any>[] = []) => {
  return arr.map((x) => {
    return { id: x.id, initial: x.initial }
  })
}

describe('sync', () => {
  it('delete', async () => {
    const a = new JobList({ id: 'A' })
    a.create(job1Opts)
    a.create(job2Opts)

    expect(extractInitial(a.toJSON())).toEqual([job1Opts, job2Opts])

    a.delete(job1Opts.id)
    expect(extractInitial(a.toJSON())).toEqual([job2Opts])

    a.delete(job2Opts.id)
    expect(extractInitial(a.toJSON())).toEqual([])
  })

  it('delete in batch', async () => {
    const a = new JobList({ id: 'A' })
    a.create(job1Opts)
    a.create(job2Opts)
    a.create(job3Opts)

    expect(extractInitial(a.toJSON())).toEqual([job1Opts, job2Opts, job3Opts])

    a.delete([job1Opts.id, job2Opts.id, job3Opts.id])
    expect(extractInitial(a.toJSON())).toEqual([])
  })
})
