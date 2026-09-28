import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitcherComponentService } from './language-switcher.service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
  providers: [LanguageSwitcherComponentService],
})
export class LanguageSwitcherComponent {
  protected readonly vm = inject(LanguageSwitcherComponentService);
}
