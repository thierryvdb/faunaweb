import { QueryResult as PgQueryResult, QueryResultRow } from 'pg';

// Simpler query result interface that doesn't enforce QueryResultRow constraint
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
  command: string;
  oid: number;
  fields: any[];
}

export type { QueryResultRow } from 'pg';
