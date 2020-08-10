import { link } from '@jacobbubu/scuttlebutt-pull'
import { JobList } from '../src'

const a = new JobList({ id: 'A' })
const b = new JobList({ id: 'B' })

const job = a.create({ id: 'job-1', initial: 'META-1' })
job.progress('STEP-1')
job.progress('STEP-2')
job.extra('EXTRA-1')
job.done(null, 'DONE')
job.extra('EXTRA-2')

console.log('job@A:', job.toJSON())

const s1 = a.createStream({ name: 's1' })
const s2 = b.createStream({ name: 's2' })

link(s1, s2)

b.on('createdByPeer', (jobId, initial, jobList, update) => {
  console.log(`job(${jobId}) created@B`, jobList.getJob(jobId).toJSON())
})

b.on('progressByPeer', (jobId, progress, jobList, update) => {
  console.log(`job(${jobId}) progress:`, progress)
})

b.on('extraByPeer', (jobId, progress, jobList, update) => {
  console.log(`job(${jobId}) extra:`, progress)
})

b.on('doneByPeer', (jobId, err, res, jobList, update) => {
  console.log(`job(${jobId}) done:`, [err, res])
})
