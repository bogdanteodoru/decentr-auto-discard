export interface IDatabase {
    DB_SERVER: string;
    DB_VERSION: number;
    DB_TABLE: string;
    getState(tabId: number, callback: any): void;
    setState(state: Object): void,
    removeState(state: Object, callback: any): void,
    clearStates(callback: any): void
}
