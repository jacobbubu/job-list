import { AsyncJobList, ToJSON } from '../src'
import { job1Opts, job2Opts } from './common'

const expectedJSON1 = {
  id: job1Opts.id,
  initial: job1Opts.initial,
  progress: ['10%'],
  extra: [],
  result: [null, 'DONE-1'],
}

const expectedJSON2 = {
  id: job2Opts.id,
  initial: job2Opts.initial,
  progress: [],
  extra: ['EXTRA-1'],
  result: ['ERROR-1', null],
}

function removeSortId(obj: ToJSON) {
  const res = { ...obj }
  delete res['sortId']
  return res
}

describe('toJSON', () => {
  it('create/progress/done', async () => {
    const a = new AsyncJobList({ id: 'A' })
    const job1 = await a.create(job1Opts)
    const job2 = await a.create(job2Opts)

    await job1.progress('10%')
    await job1.done(null, 'DONE-1')

    await job2.extra('EXTRA-1')
    await job2.done('ERROR-1')

    expect(removeSortId(job1.toJSON())).toEqual(expectedJSON1)
    expect(removeSortId(job2.toJSON())).toEqual(expectedJSON2)
    expect([job1.toJSON(), job2.toJSON()]).toEqual(await a.toJSON())
  })
})
