import { Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitcherComponentService } from './language-switcher.service';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  templateUrl: './language-switcher.html',
  providers: [LanguageSwitcherComponentService],
})
export class LanguageSwitcherComponent {
  private readonly service = inject(LanguageSwitcherComponentService);

  /** id of the <select>; must be unique when the switcher appears twice on a page. */
  readonly controlId = input('lang-switcher');

  /** Current language and the available options, read by the template. */
  protected readonly current = this.service.current;
  protected readonly options = this.service.options;

  /** Change callback from the `<select>`. */
  protected change(value: string): void {
    this.service.change(value);
  }
}
