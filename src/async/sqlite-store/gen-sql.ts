import { Sources } from '@jacobbubu/scuttlebutt-pull'

export function genSQL(tableName: string) {
  const sortIdTableName = `${tableName}SortId`

  const Initial = `
    CREATE TABLE IF NOT EXISTS ${tableName}
    (
      jobId     TEXT NOT NULL,
      cmd       TEXT NOT NULL,
      sourceId  TEXT NOT NULL,
      ts        REAL NOT NULL,
      change    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ${tableName}IdxJobId
      ON ${tableName} (jobId);

    CREATE INDEX IF NOT EXISTS ${tableName}IdxTs
      ON ${tableName} (ts);

    CREATE TABLE IF NOT EXISTS ${sortIdTableName}
      (
        sortId    TEXT NOT NULL PRIMARY KEY,
        jobId     TEXT NOT NULL UNIQUE
      );
    CREATE INDEX IF NOT EXISTS ${sortIdTableName}IdxJobId
      ON ${sortIdTableName} (jobId);
  `

  const Create = [
    `
    INSERT INTO ${tableName}(jobId, cmd, sourceId, ts, change)
      VALUES($jobId, 'create', $sourceId, $ts, $change)`,
    `INSERT INTO ${sortIdTableName}(sortId, jobId)
      VALUES($sortId, $jobId)`,
  ]

  const Update = `
    INSERT INTO ${tableName}(jobId, cmd, sourceId, ts, change)
      VALUES($jobId, $cmd, $sourceId, $ts, $change)
  `

  const UpdateSortId = [
    `INSERT INTO ${tableName}(jobId, cmd, sourceId, ts, change)
      VALUES($jobId, 'sortId', $sourceId, $ts, $change)
    `,
    `UPDATE ${sortIdTableName}
      SET sortId = $sortId
      WHERE jobId = $jobId
    `,
  ]

  const GetUpdatesById = `
    SELECT change
      FROM ${tableName}
      WHERE jobId=? ORDER BY ts ASC
  `

  const GetHistory = `
    SELECT change
      FROM ${tableName}
      ORDER BY ts ASC
  `

  const GetPrevSortId = `
    SELECT MAX(sortId) AS sortId
      FROM ${sortIdTableName}
      WHERE sortId < ?
  `

  const GetNextSortId = `
    SELECT MIN(sortId) AS sortId
      FROM ${sortIdTableName}
      WHERE sortId > ?
  `

  const GetLength = `
    SELECT COUNT(*) AS length
      FROM ${sortIdTableName}
  `

  const GetJobIdBySortIdLocation = `
    SELECT jobId
      FROM ${sortIdTableName}
      ORDER BY sortId ASC
      LIMIT 1 OFFSET ?
  `

  return {
    Initial,
    Create,
    Update,
    GetUpdatesById,
    UpdateSortId,
    GetHistory,
    GetPrevSortId,
    GetNextSortId,
    GetLength,
    GetJobIdBySortIdLocation,
  }
}

export function getHistBySources(tableName: string, sources: Sources) {
  const iters = Object.keys(sources).map((sourceId) => {
    return `SELECT * FROM ${tableName} WHERE sourceId = '${sourceId}' AND ts > ${sources[sourceId]}`
  })

  const whole =
    iters.length > 0
      ? `
    SELECT * FROM (
      SELECT * FROM ${tableName} WHERE sourceId NOT IN (${Object.keys(sources)
          .map((x) => `'${x}'`)
          .join(', ')})
      UNION
      ${iters.join('\nUNION\n')}
    )
    ORDER BY ts ASC
  `
      : `
    SELECT * FROM ${tableName} ORDER BY ts ASC
  `
  return whole
}
