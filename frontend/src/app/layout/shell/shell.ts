import { Component, inject } from '@angular/core';
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
  protected readonly vm = inject(ShellComponentService);
}
