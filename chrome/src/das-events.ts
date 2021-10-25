import {
    DasEventsEnum,
    DasEventsNamesEnum,
    DasEventsInternals,
    DasEventsTabStatuses
} from './models/das-events.enum';
import { DasStorageEnum } from './models/das-storage.enum';
import { Options } from './models/das-storage.model'
import Tab = chrome.tabs.Tab;
import TabChangeInfo = chrome.tabs.TabChangeInfo;
import TabActiveInfo = chrome.tabs.TabActiveInfo;

(function() {
    let chargingMode = false;

    // On extension install
    chrome.runtime.onInstalled.addListener(() => {
        // Show options page on install.
        chrome.tabs.create({ url: chrome.extension.getURL('index.html?#/options') });

        window.dasUtils.getOptions((options: Options) => {
            if (options[DasStorageEnum.ADD_TO_CONTEXT_MENU]) {
                buildContextMenu(true);
            }
        });
    });

    // On extension load
    chrome.runtime.onStartup.addListener(() => {
        chrome.alarms.clearAll(function () {
            localStorage.setItem(DasEventsEnum.TEMPORARY_WHITELIST, JSON.stringify([]));
            window.dasDB.clearStates(() => {
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    (tabs) => {
                        if (!!tabs.length) {
                            localStorage.setItem(DasEventsEnum.CURRENT_TAB_ID, String(tabs[0].id));
                        }
                    }
                );
            });
        });

        window.dasUtils.getOptions((options: Options) => {
            // If user has requested Discard at Startup,
            // then discardAllTabs without the forced update.
            // This allows isExcluded() tabs to survive.
            if (options[DasStorageEnum.DISCARD_AT_STARTUP]) {
                discardAllTabs({ noForce:true });
            }
        });
    });

    // On alarms triggered
    chrome.alarms.onAlarm.addListener((alarm) => {
        chrome.tabs.get(
            parseInt(alarm.name),
            (tab) => requestTabSuspension(tab)
        );
    });

    // On battery state change
    if ((window.navigator as any).getBattery) {
        (window.navigator as any).getBattery().then((battery) => {
            chargingMode = battery.charging;
            battery.onchargingchange = () => chargingMode = battery.charging;
        });
    }

    // On new tab creation
    chrome.tabs.onCreated.addListener((tab: Tab) => updateExtensionBadge(tab.id));

    // On TAB state changes
    chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: TabChangeInfo, tab) => {
        // If tab in loading state or discarded
        if (changeInfo.status === 'loading' || isDiscarded(tab)) { return; }

        window.dasDB.getState(tabId, (previousTabState) => {
            chrome.alarms.get(String(tab.id), (alarm) => {
                // If we have an audio playing tab
                // or tab no alarm and status completed
                if (
                    (!alarm && changeInfo.status === 'complete') ||
                    (!tab.audible && previousTabState && previousTabState.audible)
                ) {
                    resetTabTimer(tab);
                }

                window.dasDB.setState(tab);
            });
        });
    });

    // On window focus change
    chrome.tabs.onActivated.addListener((activeInfo: TabActiveInfo) => {
        const tabId = activeInfo.tabId;
        const windowId = activeInfo.windowId;
        const lastTabId = localStorage.getItem(DasEventsEnum.CURRENT_TAB_ID);

        // Clear timer on current tab
        clearTabTimer(tabId);

        // Update extension badge
        updateExtensionBadge(tabId);

        // Reset timer on tab that lost focus
        if (lastTabId) {
            chrome.tabs.get(
                parseInt(lastTabId),
                (lastTab: Tab) => {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError.message);
                        return false;
                    }

                    return resetTabTimer(lastTab)
                }
            );
        }

        // Set to local storage
        localStorage.setItem(DasEventsEnum.CURRENT_TAB_ID, String(tabId));
        localStorage.setItem(DasEventsEnum.PREVIOUS_TAB_ID, lastTabId);
    });

    // Utility functions
    function isDiscarded(tab) {
        return tab && tab.discarded;
    }

    function isSpecialTab(tab) {
        const url = tab.url;
        return url.indexOf('chrome-extension:') === 0 ||
            url.indexOf('chrome:') === 0 ||
            url.indexOf('decentr:') === 0 ||
            url.indexOf('decentr-extension:') === 0 ||
            url.indexOf('chrome-devtools:') === 0 ||
            url.indexOf('file:') === 0 ||
            url.indexOf('chrome.google.com/webstore') >= 0 ||
            url === '';
    }

    function discardTab(tab) {
        chrome.tabs.executeScript(tab.id, {
            code: `document.title = '${DasEventsEnum.SUSPENDED_WINDOW_TITLE_ICON.replace(/'/g, '_')} ' + document.title;`
        }, () => chrome.tabs.discard(tab.id));
    }

    function reloadTab(tab) {
        chrome.tabs.reload(tab.id);
    }

    function isExcluded(tab, options) {
        if (checkWhiteList(tab.url, options[DasStorageEnum.WHITELIST])) {
            return true;
        } else if (checkTemporaryWhiteList(tab.id)) {
            return true;
        } else if (tab.active) {
            return true;
        } else if (isSpecialTab(tab)) {
            return true;
        } else if (options[DasStorageEnum.DONT_DISCARD_PINNED] && tab.pinned) {
            return true;
        } else {
            return !!(options[DasStorageEnum.DONT_DISCARD_AUDIO] && tab.audible);
        }
    }

    function getTempWhitelistTabIds() {
        const TEMP_WHITELIST = JSON.parse(localStorage.getItem(DasEventsEnum.TEMPORARY_WHITELIST));
        return TEMP_WHITELIST ? TEMP_WHITELIST : [];
    }

    function checkTemporaryWhiteList(tabId: number) {
        return getTempWhitelistTabIds().some((element) => element === tabId);
    }

    function checkWhiteList(url: string, whitelist: Array<string>) {
        const whitelistItems = whitelist || [];
        return whitelistItems.some((item) => window.dasUtils.testForMatch(item, url));
    }

    function requestTabSuspension(tab: Tab, force?: boolean) {
        force = force || false;
        if (
            (typeof(tab) === 'undefined') ||
            (isDiscarded(tab) || isSpecialTab(tab))
        ) { return; }

        if (force) {
            discardTab(tab);
        } else {
            window.dasUtils.getOptions((options) => {
                if (!isExcluded(tab, options) &&
                    !(options[DasStorageEnum.ONLINE_CHECK] && !navigator.onLine) &&
                    !(options[DasStorageEnum.BATTERY_CHECK] && chargingMode)
                ) {
                    discardTab(tab);
                }
            });
        }
    }

    function clearTabTimer(tabId) {
        chrome.alarms.clear(String(tabId));
    }

    function resetTabTimer(tab) {
        window.dasUtils.getOption(DasStorageEnum.TIME_TO_DISCARD, (suspendTime) => {
            if (suspendTime === 0) {
                clearTabTimer(tab.id);
            } else if (tab && !isDiscarded(tab) && !tab.active && !isSpecialTab(tab)) {
                const dateToSuspend = Date.now() + (parseFloat(suspendTime) * 1000 * 60);
                chrome.alarms.create(String(tab.id), { when: dateToSuspend });
            }
        });
    }

    function whitelistCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length) {
                let rootUrlStr = tabs[0].url;
                if (rootUrlStr.includes('//')) {
                    rootUrlStr = rootUrlStr.substring(rootUrlStr.indexOf('//') + 2);
                }
                rootUrlStr = rootUrlStr.substring(0, rootUrlStr.indexOf('/'));
                window.dasUtils.saveURLToWhitelist(rootUrlStr, () => {
                    updateExtensionBadge(tabs[0].id);
                    if (isDiscarded(tabs[0])) {
                        reloadTab(tabs[0]);
                    }
                });
            }
        });
    }

    function removeCurrentTabFromWhitelist() {
        chrome.tabs.query(
            {active: true, currentWindow: true},
            (tabs: Tab[]) => tabs.length &&
                window.dasUtils.removeURLFromWhitelist(tabs[0].url,
                    () => updateExtensionBadge(tabs[0].id))
        );
    }

    function tempWhitelistCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Tab[]) => {
            if (tabs.length) {
                const TEMP_WHITELIST = getTempWhitelistTabIds();
                TEMP_WHITELIST.push(tabs[0].id);
                updateExtensionBadge(tabs[0].id);
                localStorage.setItem(
                    DasEventsEnum.TEMPORARY_WHITELIST,
                    JSON.stringify([...Array.from(new Set([...TEMP_WHITELIST]))])
                );
            }
        });
    }

    function removeTempWhitelistCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Tab[]) => {
            if (tabs.length) {
                const TEMP_WHITELIST = getTempWhitelistTabIds().filter((id) => id !== tabs[0].id);
                localStorage.setItem(DasEventsEnum.TEMPORARY_WHITELIST, JSON.stringify(TEMP_WHITELIST));
                updateExtensionBadge(tabs[0].id);
            }
        });
    }

    function discardHighlightedTab() {
        chrome.tabs.query({ active: true, currentWindow: true, discarded: false }, (tabs: Tab[]) => {
            if (!!tabs.length) {
                const tabToDiscard = tabs[0];
                const previousTabId = parseInt(localStorage.getItem(DasEventsEnum.PREVIOUS_TAB_ID));
                chrome.tabs.get(previousTabId, (prevTab: Tab) => {
                    if (prevTab) {
                        chrome.tabs.update(
                            previousTabId,
                            { active: true, highlighted: true },
                            () => discardTab(tabToDiscard)
                        );
                    } else {
                        chrome.tabs.create({}, () => discardTab(tabToDiscard));
                    }
                })
            }
        });
    }

    function reloadHighlightedTab() {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs: Tab[]) => {
            if (!!tabs.length && isDiscarded(tabs[0])) {
                reloadTab(tabs[0]);
            }
        });
    }

    function discardAllTabs(args: any = {}) {
        args = args || {};
        const force = !args.noForce;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.windows.get(tabs[0].windowId, {populate: true}, (curWindow) => {
                curWindow.tabs.forEach((tab) => {
                    if (!tab.active) {
                        requestTabSuspension(tab, force);
                    }
                });
            });
        });
    }

    function discardAllTabsInAllWindows() {
        chrome.tabs.query({}, (tabs) =>
            tabs.forEach((currentTab) =>
                requestTabSuspension(currentTab, true)));
    }

    function reloadAllTabs() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Tab[]) => {
            chrome.windows.get(tabs[0].windowId, { populate: true }, (curWindow) => {
                curWindow.tabs.forEach((currentTab) => {
                    if (isDiscarded(currentTab)) {
                        reloadTab(currentTab);
                    } else {
                        resetTabTimer(currentTab);
                    }
                });
            });
        });
    }

    function reloadAllTabsInAllWindows() {
        chrome.tabs.query({}, (tabs: Tab[]) =>
            tabs.forEach((currentTab: Tab) => isDiscarded(currentTab) ? reloadTab(currentTab) : null)
        );
    }

    function discardSelectedTabs() {
        chrome.tabs.query(
            { highlighted: true, lastFocusedWindow: true },
            (selectedTabs: Tab[]) =>
                selectedTabs.forEach((tab: Tab) =>
                    requestTabSuspension(tab, true))
        );
    }

    function reloadSelectedTabs() {
        chrome.tabs.query(
            { highlighted: true, lastFocusedWindow: true },
            (selectedTabs: Tab[]) => selectedTabs.forEach((tab: Tab) => isDiscarded(tab) ? reloadTab(tab) : null)
        );
    }

    function updateExtensionBadge(tabId) {
        // Set the extension emoji text.
        chrome.tabs.get(tabId, (tab: Tab) => {
            window.dasUtils.getOptions((options) => {
                const specialTabs = (
                    isSpecialTab(tab) ||
                    (options[DasStorageEnum.DONT_DISCARD_PINNED] && tab.pinned) ||
                    (options[DasStorageEnum.DONT_DISCARD_AUDIO] && tab.audible)
                );
                const badge = () => {
                    if (
                        checkWhiteList(tab.url, options[DasStorageEnum.WHITELIST]) ||
                        checkTemporaryWhiteList(tab.id)
                    ) {
                        return 'FAV';
                    } else if (tab.active && !specialTabs) {
                        return 'ON';
                    } else if (specialTabs) {
                        return 'OFF';
                    }
                }

                chrome.browserAction.setBadgeText({ 'text': badge() });
                chrome.browserAction.setBadgeBackgroundColor({ color: 'rgba(49, 112, 143, 1)' });
            });
        });
    }

    // Get info for a tab.
    // Defaults to currentTab if no id passed in.
    // Returns the current tab suspension and timer states.
    // Possible suspension states are:

    // normal: a tab that will be discarded
    // special: a tab that cannot be discarded
    // discarded: a tab that is discarded
    // never: suspension timer set to 'never discard'
    // formInput: a tab that has a partially completed form (and IGNORE_FORMS is true)
    // audible: a tab that is playing audio (and IGNORE_AUDIO is true)
    // tempWhitelist: a tab that has been manually paused
    // pinned: a pinned tab (and IGNORE_PINNED is true)
    // whitelisted: a tab that has been whitelisted
    // charging: computer currently charging (and BATTERY_CHECK is true)
    // noConnectivity: internet currently offline (and ONLINE_CHECK is true)
    // unknown: an error detecting tab status
    function requestTabInfo(tab, callback) {
        const TAB_INFO = {
            windowId: '',
            tabId: '',
            status: '',
            timerUp: 0,
            availableCapacityBefore: null,
            availableCapacityAfter: null
        };

        chrome.alarms.get(String(tab.id), (alarm) => {
            if (alarm && !isDiscarded(tab)) {
                TAB_INFO.timerUp = parseInt(String((alarm.scheduledTime - Date.now()) / 1000));
            }

            TAB_INFO.windowId = tab.windowId;
            TAB_INFO.tabId = tab.id;

            // Check if it is a special tab
            if (isSpecialTab(tab)) {
                TAB_INFO.status = DasEventsTabStatuses.SPECIAL;
                callback(TAB_INFO);
            } else if (isDiscarded(tab)) {
                TAB_INFO.status = DasEventsTabStatuses.DISCARDED;
                window.dasDB.getState(tab.id, (tab) => {
                    if (tab) {
                        TAB_INFO.availableCapacityBefore = tab.availableCapacityBefore;
                        TAB_INFO.availableCapacityAfter = tab.availableCapacityAfter;
                    }
                    callback(TAB_INFO);
                });
            } else {
                processActiveTabStatus(tab, (status) => {
                    TAB_INFO.status = status;
                    callback(TAB_INFO);
                });
            }
        });
    }

    function processActiveTabStatus(tab, callback) {
        let status = DasEventsTabStatuses.NORMAL;

        window.dasUtils.getOptions(function (options) {
            // Check if tab is whitelisted
            if (checkWhiteList(tab.url, options[DasStorageEnum.WHITELIST])) {
                status = DasEventsTabStatuses.WHITELISTED;

            // Check if temporary whitelist
            } else if (checkTemporaryWhiteList(tab.id)) {
                status = DasEventsTabStatuses.TEMP_WHITELISTED;

            // Check if pinned tab
            } else if (options[DasStorageEnum.DONT_DISCARD_PINNED] && tab.pinned) {
                status = DasEventsTabStatuses.PINNED;

            // Check if audible tab
            } else if (options[DasStorageEnum.DONT_DISCARD_AUDIO] && tab.audible) {
                status = DasEventsTabStatuses.AUDIBLE;

            // Check if tab was never discarded
            } else if (options[DasStorageEnum.TIME_TO_DISCARD] === 0) {
                status = DasEventsTabStatuses.NEVER;

            // Check if device is running on battery
            } else if (options[DasStorageEnum.BATTERY_CHECK] && chargingMode) {
                status = DasEventsTabStatuses.CHARGING;

            // Check if no internet connectivity
            } else if (options[DasStorageEnum.ONLINE_CHECK] && !navigator.onLine) {
                status = DasEventsTabStatuses.NO_CONNECTIVITY;
            }
            callback(status);
        });
    }

    // Message handlers
    function messageRequestListener(request, sender, sendResponse) {
        switch (request.action) {
            case DasEventsInternals.REQUEST_CURRENT_TAB_INFO:
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    (tabs: Tab[]) =>
                        tabs.length && requestTabInfo(tabs[0], (info) => sendResponse(info))
                );
                break;

            case DasEventsInternals.RESET_TAB_TIMERS:
                chrome.tabs.query({}, (tabs: Tab[]) => {
                    for (let tab of tabs) {
                        resetTabTimer(tab);
                    }
                });
                break;

            case DasEventsInternals.UPDATE_CONTEXT_MENU_ITEMS:
                buildContextMenu(request.visible);
                break;

            case DasEventsNamesEnum.DISCARD_ONE:
                discardHighlightedTab();
                break;

            case DasEventsNamesEnum.TEMP_WHITELIST_TAB:
                tempWhitelistCurrentTab();
                break;

            case DasEventsNamesEnum.TEMP_UNDO_WHITELIST_TAB:
                removeTempWhitelistCurrentTab();
                break;

            case DasEventsNamesEnum.WHITELIST_TAB:
                whitelistCurrentTab();
                break;

            case DasEventsNamesEnum.REMOVE_WHITELIST_TAB:
                removeCurrentTabFromWhitelist();
                break;

            case DasEventsNamesEnum.DISCARD_ALL:
                discardAllTabs();
                break;

            case DasEventsNamesEnum.RELOAD_ALL:
                reloadAllTabs();
                break;

            case DasEventsNamesEnum.DISCARD_SELECTED_TABS:
                discardSelectedTabs();
                break;

            case DasEventsNamesEnum.RELOAD_SELECTED_TABS:
                reloadSelectedTabs();
                break;

            default:
                break;
        }
        return true;
    }

    // Keyboard shortcuts handlers
    function commandListener (command) {
        if (command === '1-discard-current-tab') {
            discardHighlightedTab();

        } else if (command === '2-reload-current-tab') {
            reloadHighlightedTab();

        } else if (command === '3-discard-all-active-window') {
            discardAllTabs();

        } else if (command === '4-reload-all-active-window') {
            reloadAllTabs();

        } else if (command === '5-discard-all-windows') {
            discardAllTabsInAllWindows();

        } else if (command === '6-reload-all-windows') {
            reloadAllTabsInAllWindows();
        }
    }

    // Right click context menu
    function contextMenuListener(info) {
        switch (info.menuItemId) {
            case 'discard-tab':
                discardHighlightedTab();
                break;

            case 'dont-suspend-for-now':
                tempWhitelistCurrentTab();
                break;

            case 'never-discard':
                whitelistCurrentTab();
                break;

            case 'discard-others':
                discardAllTabs();
                break;

            case 'reload-all':
                reloadAllTabs();
                break;

            case 'settings':
                chrome.tabs.create({ url: chrome.extension.getURL('index.html?#/options') });
                break;

            default:
                break;
        }
    }

    // Build the context menu.
    function buildContextMenu(showContextMenu) {
        const allContexts = ["page", "frame", "editable", "image", "video", "audio"];
        const menuItems = [
            { id: "discard-tab", title: "Discard tab", contexts: allContexts },
            { id: "dont-suspend-for-now", title: "Don't discard for now", contexts: allContexts },
            { id: "never-discard", title: "Never discard this site", contexts: allContexts },
            { id: "separator", contexts: allContexts, type: "separator" },
            { id: "discard-others", title: "Discard other tabs", contexts: allContexts },
            { id: "reload-all", title: "Reload all tabs", contexts: allContexts },
            { id: "settings", title: "Settings", contexts: allContexts }
        ]
        chrome.contextMenus.removeAll();

        if (showContextMenu) {
            menuItems.forEach((item) => chrome.contextMenus.create(item));
        } else {
            chrome.contextMenus.removeAll();
        }
    }

    // Messages and commands listeners
    chrome.runtime.onMessage.addListener(messageRequestListener);
    chrome.commands.onCommand.addListener(commandListener);
    chrome.contextMenus.onClicked.addListener(contextMenuListener);
})();
