# @jacobbubu/job-list

[![Build Status](https://github.com/jacobbubu/job-list/workflows/Build%20and%20Release/badge.svg)](https://github.com/jacobbubu/job-list/actions?query=workflow%3A%22Build+and+Release%22)
[![Coverage Status](https://coveralls.io/repos/github/jacobbubu/job-list/badge.svg)](https://coveralls.io/github/jacobbubu/job-list)
[![npm](https://img.shields.io/npm/v/@jacobbubu/job-list.svg)](https://www.npmjs.com/package/@jacobbubu/job-list/)

> Implementation of job data structure with [scuttlebutt protocol](https://github.com/jacobbubu/scuttlebutt-pull).

## Intro.

`job-list` is a data structure developed based on the scuttlebutt protocol to express job status and operations.

## Usage

### Sync version

``` ts
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

```

### Async version

``` ts
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
```
