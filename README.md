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
import { JobList, Job } from '../src'

const a = new JobList({ id: 'A' })
const b = new JobList({ id: 'B' })

const job = a.create({ id: 'job-1', initial: 'META-1' })
job.progress('STEP-1')
job.progress('STEP-2')  // progress cannot be called after done
job.extra('EXTRA-1')
job.done(null, 'DONE')
job.extra('EXTRA-2')    // extra can be called after done

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
```

### Async version

``` ts
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
```
