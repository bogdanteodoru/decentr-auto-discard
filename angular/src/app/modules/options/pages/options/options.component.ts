import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { DasStorageEnum } from '../../../../../../../chrome/src/models/das-storage.enum';
import { IDatabase } from '../../../../../../../chrome/src/models/das-db.model';
import { DasStorageUtilsModel } from '../../../../../../../chrome/src/models/das-storage.model';
import { DasEventsInternals } from '../../../../../../../chrome/src/models/das-events.enum';

declare global {
  interface Window {
    dasDB: IDatabase;
    db: any;
    dasStorage: any;
    dasUtils: DasStorageUtilsModel;
  }
}

@Component({
  selector: 'app-options',
  templateUrl: 'options.component.html',
  styleUrls: ['options.component.scss']
})
export class OptionsComponent implements OnInit {
  public DasStorageEnum = DasStorageEnum;
  public optionsForm: FormGroup;
  public settingsSaved = false;

  // Keep a backup of the Chrome storage for data difference checking
  private dbBackup: any;
  private dasUtils: DasStorageUtilsModel;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Setting initial form data
    this.optionsForm = new FormGroup({
      [DasStorageEnum.ONLINE_CHECK]: new FormControl(false),
      [DasStorageEnum.BATTERY_CHECK]: new FormControl(false),
      [DasStorageEnum.DONT_DISCARD_PINNED]: new FormControl(true),
      [DasStorageEnum.DONT_DISCARD_AUDIO]: new FormControl(true),
      [DasStorageEnum.TIME_TO_DISCARD]: new FormControl(60),
      [DasStorageEnum.WHITELIST]: new FormControl([]),
      [DasStorageEnum.ADD_TO_CONTEXT_MENU]: new FormControl(true),
      [DasStorageEnum.SYNC_OPTIONS]: new FormControl(true),
      [DasStorageEnum.DISCARD_AT_STARTUP]: new FormControl(false)
    });

    this.getStorageData();
  }

  // Getting the data from the Chrome storage.
  private getStorageData(): void {
    chrome.runtime.getBackgroundPage((background: Window) => {
      this.dasUtils = background.dasUtils;
      background.dasUtils.getOptions((options) => {
        this.dbBackup = options;

        this.optionsForm.patchValue({
          ...options,
          WHITELIST: options.WHITELIST.join('\n')
        })
      })
    });
  }

  public submit(form: FormGroup) {
    const formValues = form.getRawValue();
    const options = {
      ...formValues,
      WHITELIST: formValues.WHITELIST.split('\n'),
      TIME_TO_DISCARD: parseInt(formValues.TIME_TO_DISCARD)
    }

    // Other calls we need to reset
    if (this.dbBackup.TIME_TO_DISCARD !== formValues.TIME_TO_DISCARD) {
      chrome.runtime.sendMessage({ action: DasEventsInternals.RESET_TAB_TIMERS });
    }

    if (this.dbBackup.ADD_TO_CONTEXT_MENU !== formValues.ADD_TO_CONTEXT_MENU) {
      chrome.runtime.sendMessage({
        action: DasEventsInternals.UPDATE_CONTEXT_MENU_ITEMS,
        visible: formValues.ADD_TO_CONTEXT_MENU
      });
    }

    this.dasUtils.setOptions(options, () => this.onSettingsSaved());
  }

  public onSettingsSaved(): void {
    this.settingsSaved = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.settingsSaved = false;
      this.cdr.detectChanges();
    }, 3000);
  }

  public goToDiscardedTabs(event): void {
    event.preventDefault();
    chrome.tabs.update({ url: 'decentr://discards/' });
  }

  public cancel(): void {
    // Only close the window if we were opened in a new tab.
    // Else, go back to the page we were on.
    // This is to fix closing tabs if they were opened from the context menu.
    if (document.referrer === '') {
      window.close();
    } else {
      history.back();
    }
  }
}
