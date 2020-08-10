import { link } from '@jacobbubu/scuttlebutt-pull'
import { AsyncJobList, SQLiteStore } from '../src'

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

  b.on('createdByPeer', async (jobId, initial, jobList, update) => {
    console.log(`job(${jobId}) created@B`, (await jobList.getJob(jobId)).toJSON())
  })

  b.on('progressByPeer', async (jobId, progress, jobList, update) => {
    console.log(`job(${jobId}) progress:`, progress)
  })

  b.on('extraByPeer', async (jobId, progress, jobList, update) => {
    console.log(`job(${jobId}) extra:`, progress)
  })

  b.on('doneByPeer', async (jobId, err, res, jobList, update) => {
    console.log(`job(${jobId}) done:`, [err, res])
  })
}

// tslint:disable-next-line no-floating-promises
main()
