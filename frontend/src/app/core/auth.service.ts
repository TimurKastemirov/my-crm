import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  AuthResult,
  LoginRequest,
  RegisterRequest,
  SessionInfo,
  UserDto,
} from '@crm/shared';
import { ApiClient } from './api-client';
import { TokenStorage } from './token-storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(TokenStorage);
  private readonly router = inject(Router);

  readonly user = signal<UserDto | null>(null);
  readonly organizationId = signal<string | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  private sessionLoad: Promise<boolean> | null = null;

  async login(payload: LoginRequest): Promise<void> {
    const result = await firstValueFrom(this.api.post<AuthResult>('/auth/login', payload));
    this.applyTokens(result);
    await this.loadSession(true);
    await this.router.navigate(['/']);
  }

  async register(payload: RegisterRequest): Promise<void> {
    const result = await firstValueFrom(this.api.post<AuthResult>('/auth/register', payload));
    this.applyTokens(result);
    await this.loadSession(true);
    await this.router.navigate(['/']);
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens.refresh;
    if (refreshToken) {
      try {
        await firstValueFrom(this.api.post('/auth/logout', { refreshToken }));
      } catch {
        /* всё равно чистим локально */
      }
    }
    this.tokens.clear();
    this.user.set(null);
    this.organizationId.set(null);
    await this.router.navigate(['/login']);
  }

  /**
   * Принудительно завершает сессию при 401 от API: чистит токены и состояние
   * в памяти и уводит на /login. Важно сбросить именно `user`, иначе
   * guestGuard посчитает пользователя авторизованным и вернёт его с /login.
   */
  handleUnauthorized(): void {
    this.tokens.clear();
    this.user.set(null);
    this.organizationId.set(null);
    void this.router.navigate(['/login']);
  }

  /** Гарантирует загруженную сессию для guard'а: возвращает true, если пользователь аутентифицирован. */
  async ensureSession(): Promise<boolean> {
    if (this.isAuthenticated()) return true;
    if (!this.tokens.access) return false;
    this.sessionLoad ??= this.loadSession(false);
    return this.sessionLoad;
  }

  private async loadSession(force: boolean): Promise<boolean> {
    if (!force && this.isAuthenticated()) return true;
    try {
      const session = await firstValueFrom(this.api.get<SessionInfo>('/auth/me'));
      this.user.set(session.user);
      this.organizationId.set(session.organizationId);
      return true;
    } catch {
      this.tokens.clear();
      this.user.set(null);
      this.organizationId.set(null);
      return false;
    } finally {
      this.sessionLoad = null;
    }
  }

  private applyTokens(result: AuthResult): void {
    this.tokens.set(result.tokens);
    this.user.set(result.user);
  }
}
