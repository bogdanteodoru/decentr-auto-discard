import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DasStorageEnum } from '../../../../../../../chrome/src/models/das-storage.enum';

@Component({
  selector: 'app-shortcuts',
  templateUrl: 'shortcuts.component.html',
  styleUrls: ['shortcuts.component.scss']
})
export class ShortcutsComponent implements OnInit {
  public DasStorageEnum = DasStorageEnum;
  public shortcuts: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    chrome.commands.getAll((commands) => {
      this.shortcuts = commands.filter((command: any) => command.name !== '_execute_browser_action')
      this.cdr.detectChanges();
    })
  }

  public goToDiscardedTabs(event): void {
    event.preventDefault();
    chrome.tabs.update({ url: 'decentr://discards/' });
  }

  public goToShortcuts(event): void {
    event.preventDefault();
    chrome.tabs.update({url: 'decentr://extensions/shortcuts'});
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
