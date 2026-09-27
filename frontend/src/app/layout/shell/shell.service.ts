import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Injectable()
export class ShellComponentService {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.user;
  readonly menuOpen = signal(false);

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
