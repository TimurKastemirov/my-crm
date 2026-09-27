import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  template: `
    <h1 class="text-xl font-semibold text-slate-900">Дашборд</h1>
    <p class="mt-2 text-sm text-slate-500">
      Добро пожаловать, {{ user()?.firstName }}. Слева — разделы CRM.
    </p>
    <p class="mt-1 text-xs text-slate-400">Сводка и графики появятся в Фазе 2.</p>
  `,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;
}
