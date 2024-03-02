export type IsolationLevel = 'REPEATABLE READ' | 'SERIALIZABLE' | 'READ COMMITTED' | 'READ UNCOMMITTED';

/**
 * get all properties from prototype of object
 * @param obj
 * @returns
 */
export function getAllPropsOfObj(obj) {
  const set = new Set<string>();
  for (; obj !== null; obj = Object.getPrototypeOf(obj)) {
    const op = Object.getOwnPropertyNames(obj);
    for (let i = 0; i < op.length; i++) {
      const name = op[i];
      set.add(name);
    }
  }
  return Array.from(set);
}

export function extractSqlQuery(input: { sql: string } | string) {
  return (typeof input === 'string' ? input : input.sql).trim().toUpperCase();
}
