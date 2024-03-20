export type IsolationLevel = 'REPEATABLE READ' | 'SERIALIZABLE' | 'READ COMMITTED' | 'READ UNCOMMITTED';
/**
 * get all properties from prototype of object
 * @param obj
 * @returns
 */
export declare function getAllPropsOfObj(obj: any): string[];
export declare function extractSqlQuery(input: {
    sql: string;
} | string): string;
