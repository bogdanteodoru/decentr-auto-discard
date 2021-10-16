import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ShortcutsRoutingModule } from './shortcuts-routing.module';
import { ShortcutsComponent } from './pages/shortcuts/shortcuts.component';

@NgModule({
  declarations: [ShortcutsComponent],
  imports: [CommonModule, ShortcutsRoutingModule]
})
export class ShortcutsModule {}
