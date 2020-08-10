import { link } from '@jacobbubu/scuttlebutt-pull'
import { AsyncJobList, AsyncJob, SQLiteStore } from '../src'

const main = async () => {
  const tableName = 'JobList'

  const a = new AsyncJobList({
    id: 'A',
    store: new SQLiteStore({ filename: ':memory:' }, tableName),
  })
  const b = new AsyncJobList({
    id: 'B',
    store: new SQLiteStore({ filename: ':memory:' }, tableName),
  })

  const job = await a.create({ id: 'job-A', initial: 'META-1' })
  await job.progress('STEP-1')
  await job.progress('STEP-2')
  await job.extra('EXTRA-1')
  await job.done(null, 'DONE!')
  await job.extra('EXTRA-2')

  console.log('job@A:', job.toJSON())

  const s1 = a.createStream({ name: 's1' })
  const s2 = b.createStream({ name: 's2' })

  link(s1, s2)

  b.on('createdByPeer', async (job: AsyncJob) => {
    console.log('job created@B', job.toJSON())
  })

  b.on('progressByPeer', (job: AsyncJob, progress) => {
    console.log('job progress:', job.id, progress)
  })

  b.on('extraByPeer', (job: AsyncJob, extra) => {
    console.log('job extra:', job.id, extra)
  })

  b.on('sortIdByPeer', (job: AsyncJob, sortId) => {
    console.log('job sortId:', job.id, sortId)
  })

  b.on('doneByPeer', (job: AsyncJob, err, result) => {
    console.log('job done', job.id, { err, result })
  })
}

// tslint:disable-next-line no-floating-promises
main()
