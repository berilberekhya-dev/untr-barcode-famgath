export type SqlValue = string | number | bigint | boolean | null | Uint8Array;
export type Statement = string | { sql: string; args?: SqlValue[] };
export type QueryResult = { rows: Record<string, unknown>[] };
export interface StorageTransaction {
  execute(statement: Statement): Promise<QueryResult>;
  batch(statements: Statement[]): Promise<QueryResult[]>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): void;
}
export interface StorageClient {
  execute(statement: Statement): Promise<QueryResult>;
  transaction(mode: 'read' | 'write'): Promise<StorageTransaction>;
  close(): void | Promise<void>;
}
export interface Database {
  client: StorageClient;
  ready(): Promise<void>;
  serializeWrite<T>(operation: () => Promise<T>): Promise<T>;
}
