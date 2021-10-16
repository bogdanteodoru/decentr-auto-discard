import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  DasEventsInternals,
  DasEventsNamesEnum,
  DasEventsTabStatuses
} from '../../../../../../../chrome/src/models/das-events.enum';
import { DasStorageEnum } from '../../../../../../../chrome/src/models/das-storage.enum';
import Tab = chrome.tabs.Tab;

@Component({
  selector: 'app-popup',
  templateUrl: 'popup.component.html',
  styleUrls: ['popup.component.scss']
})
export class PopupComponent implements OnInit {
  public discardSelectedGroup: boolean = false;
  public canWhitelist: boolean = false;
  public canTempWhitelist: boolean = false;
  public canDiscard: boolean = false;

  public headerStatusText: string = '';
  public headerSecondaryClass: any;
  public headerStatusMessage: any;
  public headerStatusAction: any;

  public DasEventsNamesEnum = DasEventsNamesEnum;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.tempUIFix();

    chrome.runtime.sendMessage(
      { action: DasEventsInternals.REQUEST_CURRENT_TAB_INFO },
      (info) => {
        chrome.runtime.getBackgroundPage((background: Window) => {
          background.dasUtils.getOptions((options) => {
            const status = info && info.status;
            this.canWhitelist = PopupComponent.addURLToWhitelistVisibility(status);
            this.canTempWhitelist = PopupComponent.canBePausedVisibility(status);
            this.canDiscard = PopupComponent.discardOneVisibility(status, options);
            this.setTabStatus(status);
            this.setDiscardSelectedVisibility();

            this.cdr.detectChanges();
          })
        });
      }
    );
  }

  private static discardOneVisibility(status: string, options: any): boolean {
    return (
      !(
        status === DasEventsTabStatuses.DISCARDED ||
        status === DasEventsTabStatuses.SPECIAL ||
        status === DasEventsTabStatuses.UNKNOWN
      ) &&
      !(
        (status === DasEventsTabStatuses.PINNED && options[DasStorageEnum.DONT_DISCARD_PINNED]) ||
        (status === DasEventsTabStatuses.AUDIBLE && options[DasStorageEnum.DONT_DISCARD_AUDIO])
      )
    );
  }

  private static addURLToWhitelistVisibility(status: string): boolean {
    return status !== DasEventsTabStatuses.WHITELISTED &&
      status !== DasEventsTabStatuses.SPECIAL;
  }

  private static canBePausedVisibility(status: string): boolean {
    return status === DasEventsTabStatuses.NORMAL;
  }

  private setDiscardSelectedVisibility() {
    chrome.tabs.query(
      { highlighted: true, lastFocusedWindow: true },
      (tabs: Tab[]) => this.discardSelectedGroup = tabs && !!tabs.length);
  }

  private setTabStatus(status: string): void {
    switch (status) {
      case DasEventsTabStatuses.NORMAL:
        this.headerStatusText = 'Current tab will be discarded automatically';
        this.headerSecondaryClass = 'header-success';
        break;
      case DasEventsTabStatuses.SPECIAL:
        this.headerStatusText = 'This tab cannot be discarded';
        this.headerSecondaryClass = 'header-danger';
        break;
      case DasEventsTabStatuses.WHITELISTED:
        this.headerStatusText = 'Site whitelisted.';
        this.headerStatusMessage = 'Remove from whitelist?'
        this.headerStatusAction = DasEventsNamesEnum.REMOVE_WHITELIST_TAB;
        this.headerSecondaryClass = 'header-info';
        break;
      case DasEventsTabStatuses.AUDIBLE:
        this.headerStatusText = 'Tab is currently playing audio';
        this.headerSecondaryClass = 'header-info';
        break;
      case DasEventsTabStatuses.PINNED:
        this.headerStatusText = 'Tab is currently pinned';
        this.headerSecondaryClass = 'header-info';
        break;
      case DasEventsTabStatuses.TEMP_WHITELISTED:
        this.headerStatusText = 'Tab discard paused.'
        this.headerStatusMessage = 'Unpause?'
        this.headerStatusAction = DasEventsNamesEnum.TEMP_UNDO_WHITELIST_TAB;
        this.headerSecondaryClass = 'header-info';
        break;
      case DasEventsTabStatuses.NEVER:
        this.headerStatusText = 'Automatic tab discard disabled';
        this.headerSecondaryClass = 'header-danger';
        break;
      case DasEventsTabStatuses.NO_CONNECTIVITY:
        this.headerStatusText = 'Cannot discard tabs when there is no internet connection';
        this.headerSecondaryClass = 'header-danger';
        break;
      case DasEventsTabStatuses.CHARGING:
        this.headerStatusText = 'Cannot discard tabs while power charging';
        this.headerSecondaryClass = 'header-danger';
        break;
    }
  }

  public getRealEmoji(code: number) {
    return String.fromCodePoint(code);
  }

  public doAction(action: string): void {
    chrome.runtime.sendMessage({ action: action });
    window.close();
  }

  public goToSettings(): void {
    chrome.tabs.create({ url: chrome.extension.getURL('index.html?#/options') });
  }

  private tempUIFix(): void {
    /**
     * Temporary workaround for secondary monitors on MacOS where redraws don't happen
     * @See https://bugs.chromium.org/p/chromium/issues/detail?id=971701
     */
    if (
      // From testing the following conditions seem to indicate that the popup was opened on a secondary monitor
      window.screenLeft < 0 ||
      window.screenTop < 0 ||
      window.screenLeft > window.screen.width ||
      window.screenTop > window.screen.height
    ) {
      chrome.runtime.getPlatformInfo((info) => {
        if (info.os === 'mac') {
          const fontFaceSheet = new CSSStyleSheet()
          fontFaceSheet.insertRule(`
            @keyframes redraw {
              0% {
                opacity: 1;
              }
              100% {
                opacity: .99;
              }
            }
          `);

          fontFaceSheet.insertRule(`
            html {
              animation: redraw 1s linear infinite;
            }
          `);

          (document as any).adoptedStyleSheets = [
            ...(document as any).adoptedStyleSheets,
            fontFaceSheet,
          ]
        }
      })
    }
  }
}
