import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ShellComponentService } from './shell.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  providers: [ShellComponentService],
})
export class ShellComponent {
  protected readonly vm = inject(ShellComponentService);
}
