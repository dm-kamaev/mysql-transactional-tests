import mysql from 'mysql2';
import { IsolationLevel } from '../lib';
export declare function startTransaction({ isolationLevel, onQuery, }?: {
    isolationLevel?: IsolationLevel;
    onQuery?: (input: string | mysql.QueryOptions) => void;
}): Promise<{
    rollback(): Promise<void>;
}>;
export declare function unPatch(): void;
export declare function setDebug(debugMode: boolean): void;
