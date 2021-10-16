import { IDatabase } from './models/das-db.model';
import { DasStorageUtilsModel } from './models/das-storage.model';
import * as db from './db.js';

declare global {
    interface Window {
        dasDB: IDatabase;
        db: any;
        dasStorage: any;
        dasUtils: DasStorageUtilsModel;
    }
}

(function (window) {
    const _database: IDatabase = {
        DB_SERVER: 'das',
        DB_VERSION: 1,
        DB_TABLE: 'dasState',
        getState: getState,
        setState: setState,
        removeState: removeState,
        clearStates: clearStates
    };

    window.dasDB = _database;

    function getState(id: number, callback: any) {
        getDBServer
            .then((server) => server.query(_database.DB_TABLE).filter('id', id).execute())
            .then((results) => callback(!!results.length ? results[0] : null))
            .catch((e) => console.error(e));
    }

    function setState(newState: any) {
        getDBServer
            .then((server) => server.query(_database.DB_TABLE).filter('id', newState.id).execute())
            .then((result) => getDBServer.then((server) =>
                server[!!result.length ? 'update' : 'add'](_database.DB_TABLE, newState)))
            .catch(() => getDBServer.then((server) =>
                server.update(_database.DB_TABLE, newState)))
            .catch((e) => console.log(e));
    }

    function removeState(state: any, callback: any) {
        getDBServer
            .then((server) => server.query(_database.DB_TABLE).filter('id', state.id).execute())
            .then((result) => !!result.length ?
                getDBServer.then((server) => server.remove(_database.DB_TABLE, state.id)) : null)
            .then(callback || function() {})
            .catch((e) => console.error(e));
    }

    function clearStates(callback) {
        getDBServer
            .then((server) => server.clear(_database.DB_TABLE))
            .then(callback || function() {})
            .catch((e) => console.error(e));
    }

    const getDBServer = (() => {
        return db.open({
            server: _database.DB_SERVER,
            version: _database.DB_VERSION,
            schema: {
                [_database.DB_TABLE]: {
                    key: { keyPath: 'id' },
                    indexes: { id: {} }
                }
            }
        });
    })().then((server) => server)
}(window));
