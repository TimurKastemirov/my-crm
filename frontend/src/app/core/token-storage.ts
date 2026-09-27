import { Injectable } from '@angular/core';
import type { AuthTokens } from '@crm/shared';

/**
 * Хранит пару токенов в localStorage. Все обращения обёрнуты в try/catch —
 * приватный режим/заблокированный сторедж не должны ронять приложение.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private readonly ACCESS = 'crm.accessToken';
  private readonly REFRESH = 'crm.refreshToken';

  get access(): string | null {
    try {
      return localStorage.getItem(this.ACCESS);
    } catch {
      return null;
    }
  }

  get refresh(): string | null {
    try {
      return localStorage.getItem(this.REFRESH);
    } catch {
      return null;
    }
  }

  set(tokens: AuthTokens): void {
    try {
      localStorage.setItem(this.ACCESS, tokens.accessToken);
      localStorage.setItem(this.REFRESH, tokens.refreshToken);
    } catch {
      /* сторедж недоступен — сессия проживёт в памяти до перезагрузки */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.ACCESS);
      localStorage.removeItem(this.REFRESH);
    } catch {
      /* игнорируем */
    }
  }
}
