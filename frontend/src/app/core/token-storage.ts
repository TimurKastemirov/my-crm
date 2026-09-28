import { Injectable } from '@angular/core';
import type { AuthTokens } from '@crm/shared';

/**
 * Stores the token pair in localStorage. All accesses are wrapped in try/catch —
 * private mode/blocked storage should not crash the app.
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
      /* storage unavailable — the session will live in memory until reload */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.ACCESS);
      localStorage.removeItem(this.REFRESH);
    } catch {
      /* ignore */
    }
  }
}
