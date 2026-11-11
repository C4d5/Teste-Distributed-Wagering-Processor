
export interface DbQueryResult<T> {
  rows: T[];
}

export interface DbClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<DbQueryResult<T>>;
}