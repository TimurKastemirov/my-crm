import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../../shared/ui/language-switcher/language-switcher';
import { ShellComponentService } from './shell.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './shell.html',
  providers: [ShellComponentService],
})
export class ShellComponent {
  private readonly service = inject(ShellComponentService);

  /** Current user, read by the template. */
  protected readonly user = this.service.user;

  /** Mobile navigation drawer open state. */
  protected readonly menuOpen = signal(false);

  // `label` is an i18n key resolved with the translate pipe in the template;
  // items the user has no permission for are hidden.
  protected readonly nav = computed(() => this.service.visibleNav());

  protected logout(): void {
    this.service.logout();
  }
}
