import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-dvh bg-slate-50 text-slate-800">
      <div class="mx-auto flex max-w-7xl">
        <aside class="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
          <div class="px-2 text-lg font-semibold text-indigo-600">CRM</div>
          <nav class="mt-6 flex flex-col gap-1">
            @for (item of nav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >{{ item.label }}</a>
            }
          </nav>
        </aside>

        <div class="flex min-h-dvh flex-1 flex-col">
          <header class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div class="text-sm text-slate-500">
              {{ user()?.firstName }} {{ user()?.lastName }}
              <span class="text-slate-400">· {{ user()?.email }}</span>
            </div>
            <button
              type="button"
              (click)="logout()"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >Выйти</button>
          </header>

          <main class="flex-1 p-6">
            <router-outlet />
          </main>
        </div>
      </div>
    </div>
  `,
})
export class Shell {
  private readonly auth = inject(AuthService);
  readonly user = this.auth.user;

  readonly nav = [
    { path: '/', label: 'Дашборд' },
    { path: '/contacts', label: 'Клиенты' },
    { path: '/companies', label: 'Компании' },
    { path: '/leads', label: 'Лиды' },
    { path: '/deals', label: 'Сделки' },
    { path: '/tasks', label: 'Задачи' },
  ];

  logout(): void {
    void this.auth.logout();
  }
}
