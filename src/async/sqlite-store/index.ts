import { Update, UpdateItems, Sources } from '@jacobbubu/scuttlebutt-pull'
import { hi as highChar, lo as lowChar } from '@jacobbubu/between-ts'
import LRUCache = require('lru-cache')
import * as sqlite3 from 'sqlite3'
import { Database, Statement, open, ISqlite } from 'sqlite'

import { JobId, SortId } from '../../common'
import { AsyncStoreBase } from '../async-store-base'
import { AsyncJob } from '../async-job'
import { genSQL, getHistBySources } from './gen-sql'

interface Context {
  db: Database
  create: Statement[]
  update: Statement
  getUpdatesById: Statement
  updateSortId: Statement[]
  getHistory: Statement
  getPrevSortId: Statement
  getNextSortId: Statement
  getLength: Statement
  getJobIdBySortIdLocation: Statement
}

export type SQLiteStoreOptions = Pick<ISqlite.Config, 'filename'> &
  Partial<Omit<ISqlite.Config, 'filename'>> & {
    db?: Database
    maxItems?: number
  }

export class SQLiteStore extends AsyncStoreBase {
  private readonly _dbOrConfig: Database | ISqlite.Config
  private _context: Context | null = null
  private readonly _tableName: string

  private readonly _jobCache: LRUCache<JobId, AsyncJob>

  constructor(opts: SQLiteStoreOptions, tableName: string) {
    super()
    if (opts.db) {
      this._dbOrConfig = opts.db
    } else {
      this._dbOrConfig = {
        filename: opts.filename,
      } as ISqlite.Config
      this._dbOrConfig.driver = sqlite3.Database
    }
    this._tableName = tableName
    this._jobCache = new LRUCache({
      max: opts.maxItems ?? 100,
    })
  }

  get tableName() {
    return this._tableName
  }

  async getJob(jobId: JobId) {
    let job = this._jobCache.get(jobId)
    if (!job) {
      const updates = await this.getUpdatesById(jobId)
      if (updates.length !== 0) {
        job = this.createJob(jobId, updates)
        this._jobCache.set(jobId, job)
        return job
      }
      return undefined
    }
    return job
  }

  async init() {
    const sqls = genSQL(this._tableName)

    const db = await (this._dbOrConfig instanceof Database
      ? this._dbOrConfig
      : open(this._dbOrConfig))

    await db.exec(sqls.Initial)

    this._context = {
      db,
      create: await Promise.all(sqls.Create.map((stmt) => db.prepare(stmt))),
      update: await db.prepare(sqls.Update),
      getUpdatesById: await db.prepare(sqls.GetUpdatesById),
      updateSortId: await Promise.all(sqls.UpdateSortId.map((stmt) => db.prepare(stmt))),
      getHistory: await db.prepare(sqls.GetHistory),
      getPrevSortId: await db.prepare(sqls.GetPrevSortId),
      getNextSortId: await db.prepare(sqls.GetNextSortId),
      getLength: await db.prepare(sqls.GetLength),
      getJobIdBySortIdLocation: await db.prepare(sqls.GetJobIdBySortIdLocation),
    }
  }

  async getUpdatesById(jobId: JobId) {
    if (!this._context) {
      await this.init()
    }
    const { getUpdatesById } = this._context!
    const dbRes = await getUpdatesById.all([jobId])
    return dbRes.map((row) => JSON.parse(row['change']))
  }

  async update(update: Update) {
    if (!this._context) {
      await this.init()
    }

    const [jobId, payload] = update[UpdateItems.Data]
    const sourceId = update[UpdateItems.SourceId]
    const ts = update[UpdateItems.Timestamp]
    const [cmd, sortId] = payload
    const { db } = this._context!

    let dbRes
    switch (cmd) {
      case 'create':
        const { create } = this._context!
        await db.exec('BEGIN')
        try {
          dbRes = await create[0].run({
            $jobId: jobId,
            $sourceId: sourceId,
            $ts: ts,
            $change: JSON.stringify(update),
          })
          if (dbRes.changes !== 0) {
            dbRes = await create[1].run({
              $jobId: jobId,
              $sortId: sortId,
            })
          }
          if (dbRes.changes! === 0) {
            await db.exec('ROLLBACK')
            return false
          }
          await db.exec('COMMIT')
        } catch (err) {
          await db.exec('ROLLBACK')
          throw err
        }
        break
      case 'sortId':
        const { updateSortId } = this._context!
        await db.exec('BEGIN')
        try {
          dbRes = await updateSortId[0].run({
            $jobId: jobId,
            $sourceId: sourceId,
            $ts: ts,
            $change: JSON.stringify(update),
          })
          if (dbRes.changes !== 0) {
            dbRes = await updateSortId[1].run({
              $jobId: jobId,
              $sortId: sortId,
            })
          }
          if (dbRes.changes! === 0) {
            await db.exec('ROLLBACK')
            return false
          }
          await db.exec('COMMIT')
        } catch (err) {
          await db.exec('ROLLBACK')
          throw err
        }
        break
      default:
        const { update: updateStmt } = this._context!
        dbRes = await updateStmt.run({
          $jobId: jobId,
          $cmd: cmd,
          $sourceId: sourceId,
          $ts: ts,
          $change: JSON.stringify(update),
        })
        if (dbRes.changes! <= 0) return false
    }

    // re-cache when cache missed
    let job = this._jobCache.get(jobId)
    if (!job) {
      job = await this.getJob(jobId)
    } else {
      job.updateFired(update)
    }
    return true
  }

  async getHistory(sources: Sources): Promise<Update[]> {
    if (!this._context) {
      await this.init()
    }

    const { db } = this._context!
    const sql = getHistBySources(this._tableName, sources)
    return (await db.all(sql)).map((row) => JSON.parse(row['change']))
  }

  async lastSortId(): Promise<SortId | undefined> {
    if (!this._context) {
      await this.init()
    }
    const { getPrevSortId } = this._context!
    const dbResult = await getPrevSortId.all(highChar)
    const sortId = dbResult[0]['sortId']
    return sortId ?? undefined
  }

  async prevSortId(target: SortId = highChar) {
    if (!this._context) {
      await this.init()
    }
    const { getPrevSortId } = this._context!
    const dbResult = await getPrevSortId.all(target)
    const sortId = dbResult[0]['sortId']
    return sortId ?? undefined
  }

  async nextSortId(target: SortId = lowChar) {
    if (!this._context) {
      await this.init()
    }
    const { getNextSortId } = this._context!
    const dbResult = await getNextSortId.all(target)
    const sortId = dbResult[0]['sortId']
    return sortId ?? undefined
  }

  async at(index: number) {
    if (!this._context) {
      await this.init()
    }
    const { getJobIdBySortIdLocation } = this._context!
    const dbResult = await getJobIdBySortIdLocation.all(index)
    return dbResult.length > 0 ? dbResult[0]['jobId'] : undefined
  }

  async getLength() {
    if (!this._context) {
      await this.init()
    }
    const { getLength } = this._context!
    const dbResult = await getLength.all()
    return dbResult.length > 0 ? dbResult[0]['length'] : undefined
  }

  async tearOff() {
    return
  }

  private createJob(jobId: JobId, updates?: Update[]): AsyncJob {
    const job = new AsyncJob(this, jobId)
    if (updates) {
      job.loadUpdates(updates)
    }
    return job
  }
}
