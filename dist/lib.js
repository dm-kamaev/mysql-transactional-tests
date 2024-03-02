"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSqlQuery = exports.getAllPropsOfObj = void 0;
/**
 * get all properties from prototype of object
 * @param obj
 * @returns
 */
function getAllPropsOfObj(obj) {
    const set = new Set();
    for (; obj !== null; obj = Object.getPrototypeOf(obj)) {
        const op = Object.getOwnPropertyNames(obj);
        for (let i = 0; i < op.length; i++) {
            const name = op[i];
            set.add(name);
        }
    }
    return Array.from(set);
}
exports.getAllPropsOfObj = getAllPropsOfObj;
function extractSqlQuery(input) {
    return (typeof input === 'string' ? input : input.sql).trim().toUpperCase();
}
exports.extractSqlQuery = extractSqlQuery;
