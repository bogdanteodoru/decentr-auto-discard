import { DasStorageEnum } from './models/das-storage.enum';
import { DasStorageUtilsModel, Options } from './models/das-storage.model';

(function (window) {
    const storage = {
        ONLINE_CHECK: DasStorageEnum.ONLINE_CHECK,
        BATTERY_CHECK: DasStorageEnum.BATTERY_CHECK,
        TIME_TO_DISCARD: DasStorageEnum.TIME_TO_DISCARD,
        DONT_DISCARD_PINNED: DasStorageEnum.DONT_DISCARD_PINNED,
        DONT_DISCARD_FORMS: DasStorageEnum.DONT_DISCARD_FORMS,
        DONT_DISCARD_AUDIO: DasStorageEnum.DONT_DISCARD_AUDIO,
        IGNORE_CACHE: DasStorageEnum.IGNORE_CACHE,
        ADD_TO_CONTEXT_MENU: DasStorageEnum.ADD_TO_CONTEXT_MENU,
        DONT_NAG_ME: DasStorageEnum.DONT_NAG_ME,
        WHITELIST: DasStorageEnum.WHITELIST,
        SYNC_OPTIONS: DasStorageEnum.SYNC_OPTIONS,
        DISCARD_AT_STARTUP: DasStorageEnum.DISCARD_AT_STARTUP
    };

    const utils: DasStorageUtilsModel = {
        getOption: getOption,
        getOptions: getOptions,
        setOption: setOption,
        setOptions: setOptions,
        syncOptions: syncOptions,
        saveURLToWhitelist: saveURLToWhitelist,
        removeURLFromWhitelist: removeURLFromWhitelist,
        testForMatch: testForMatch
    }

    const defaults = {
        [storage.ONLINE_CHECK]: false,
        [storage.BATTERY_CHECK]: false,
        [storage.DONT_DISCARD_PINNED]: true,
        [storage.DONT_DISCARD_FORMS]: true,
        [storage.DONT_DISCARD_AUDIO]: true,
        [storage.IGNORE_CACHE]: false,
        [storage.ADD_TO_CONTEXT_MENU]: true,
        [storage.TIME_TO_DISCARD]: 60,
        [storage.DONT_NAG_ME]: false,
        [storage.WHITELIST]: [],
        [storage.SYNC_OPTIONS]: true,
        [storage.DISCARD_AT_STARTUP]: false
    };

    window.dasStorage = storage;
    window.dasUtils = utils;

    function getOption(prop: string, callback: any) {
        getOptions((options) => callback(options[prop]));
    }

    function getOptions(callback: any) {
        chrome.storage.local.get(null, (options: Options) => {
            for (let prop in defaults) {
                if (typeof(options[prop]) !== 'undefined' && options[prop] !== null) {
                    defaults[prop] = options[prop];
                }
            }

            // Overlay sync updates in the local data store.
            // Like sync itself, we just guarantee eventual consistency.
            if (defaults[storage.SYNC_OPTIONS]) {
                chrome.storage.sync.get(null, (syncOptions: Options) => {
                    for (let prop in defaults) {
                        if (
                            syncOptions[prop] !== undefined &&
                            JSON.stringify(syncOptions[prop]) !== JSON.stringify(defaults[prop])
                        ) {
                            setOption(prop, syncOptions[prop]);
                            defaults[prop] = syncOptions[prop];
                        }
                    }
                });
            }

            callback(defaults);
        });
    }

    function setOption(prop: string, value: any, callback?: any) {
        let option = {};
        option[prop] = value;
        setOptions(option, callback || function() {});
    }

    function setOptions(valueByProp:any, callback?: any) {
        chrome.storage.local.get(null, (options: Options) => {
            for (let prop in valueByProp) {
                if (valueByProp.hasOwnProperty(prop)) {
                    options[prop] = valueByProp[prop];
                }
            }
            syncOptions(options);
            chrome.storage.local.set(options, callback = callback || (() => {}));
        });
    }

    function syncOptions(options: any) {
        if (options[storage.SYNC_OPTIONS]) {
            const syncObjects = {...options};
            delete syncObjects[storage.SYNC_OPTIONS];
            chrome.storage.sync.set(syncObjects, () => {});
        }
    }

    function saveURLToWhitelist(url: string, callback: any) {
        getOption(storage.WHITELIST, (whitelist) => {
            const _whitelist = [...whitelist];
            _whitelist.push(url);
            setOption(
                storage.WHITELIST,
                [...Array.from(new Set(_whitelist))],
                callback || function() {}
            );
        });
    }

    function removeURLFromWhitelist(url: string, callback?: any) {
        getOption(storage.WHITELIST, (whitelist) => {
            const _whitelist = whitelist.filter((item) => !testForMatch(item, url));
            setOption(storage.WHITELIST, _whitelist, callback || function() {});
        });
    }

    function testForMatch(item: string, searchEl: string) {
        let isRegexExp = true;

        if (item.length < 1) {
            return false;
        }

        // Check if item (in whitelist) is a regular expression
        try {
            new RegExp(item);
        } catch(e) {
            isRegexExp = false;
        }

        // If is indeed a valid regular Exp
        if (isRegexExp) {
            return new RegExp(item).test(searchEl);
        }

        return item.includes(searchEl);
    }
}(window));

