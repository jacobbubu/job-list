import { link } from '@jacobbubu/scuttlebutt-pull'
import { JobList, Job } from '../src'

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

b.on('createdByPeer', (job: Job) => {
  console.log('job created@B', job.toJSON())
})

b.on('progressByPeer', (job: Job, progress) => {
  console.log('job progress:', job.id, progress)
})

b.on('extraByPeer', (job: Job, extra) => {
  console.log('job extra:', job.id, extra)
})

b.on('sortIdByPeer', (job: Job, sortId) => {
  console.log('job sortId:', job.id, sortId)
})

b.on('doneByPeer', (job: Job, err, result) => {
  console.log('job done', job.id, { err, result })
  console.log('job@B', job.toJSON())
})
