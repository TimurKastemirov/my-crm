import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  AcceptInvitationRequest,
  AuthResult,
  AuthTokens,
  InvitationPreview,
  LoginRequest,
  Permission,
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
  /** Permission codes in the active organization — for hiding UI only; the server enforces them. */
  readonly permissions = signal<readonly Permission[]>([]);
  readonly isAuthenticated = computed(() => this.user() !== null);

  private sessionLoad: Promise<boolean> | null = null;
  /** The refresh in flight, shared by every request that got a 401 meanwhile. */
  private refreshing: Promise<string | null> | null = null;

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

  /** Public: what an invitation link grants, shown before accepting. */
  previewInvitation(token: string): Promise<InvitationPreview> {
    return firstValueFrom(this.api.post<InvitationPreview>('/auth/invitations/preview', { token }));
  }

  /** Accepts an invitation and signs in to the inviting organization (replaces any current session). */
  async acceptInvitation(payload: AcceptInvitationRequest): Promise<void> {
    const result = await firstValueFrom(this.api.post<AuthResult>('/auth/invitations/accept', payload));
    this.applyTokens(result);
    await this.loadSession(true);
    await this.router.navigate(['/']);
  }

  /** Whether the current user has the permission in the active organization. */
  can(permission: Permission): boolean {
    return this.permissions().includes(permission);
  }

  /**
   * Renews the session after a 401 on a request sent with `sentAccessToken`. Resolves the access
   * token to retry with, or null when the session is over (refresh refused). Rejects on a
   * transient failure (network, 5xx, 429) so the session survives and only that request fails.
   * Concurrent callers share one refresh; tabs coordinate through a Web Lock — refresh tokens are
   * single-use and reusing one makes the server revoke the whole session family.
   */
  refreshAccessToken(sentAccessToken: string | null): Promise<string | null> {
    // Another request or tab already renewed the session: retry with the current token.
    const current = this.tokens.access;
    if (current && current !== sentAccessToken) return Promise.resolve(current);
    this.refreshing ??= this.renewTokens().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async renewTokens(): Promise<string | null> {
    const seenRefresh = this.tokens.refresh;
    return withRefreshLock(async () => {
      const refreshToken = this.tokens.refresh;
      if (!refreshToken) return null;
      // Another tab renewed while we waited for the lock.
      if (refreshToken !== seenRefresh) return this.tokens.access;
      try {
        const tokens = await firstValueFrom(
          this.api.post<AuthTokens>('/auth/refresh', { refreshToken }),
        );
        // Signed out / in again meanwhile: keep that session, don't resurrect this one.
        if (this.tokens.refresh !== refreshToken) return this.tokens.access;
        this.tokens.set(tokens);
        return tokens.accessToken;
      } catch (error) {
        // A newer pair arrived meanwhile (e.g. password change): use it.
        if (this.tokens.refresh !== refreshToken) return this.tokens.access;
        const status = (error as HttpErrorResponse | undefined)?.status;
        if (status === 401 || status === 400) return null;
        throw error;
      }
    });
  }

  /** Uses a new token pair for the current session (e.g. after a password change). */
  useTokens(tokens: AuthTokens): void {
    this.tokens.set(tokens);
  }

  /** Ends every session of the user (all devices), then this one locally. */
  async logoutEverywhere(): Promise<void> {
    await firstValueFrom(this.api.post('/auth/logout-all'));
    this.tokens.clear();
    this.user.set(null);
    this.organizationId.set(null);
    this.permissions.set([]);
    await this.router.navigate(['/login']);
  }

  async logout(): Promise<void> {
    const refreshToken = this.tokens.refresh;
    if (refreshToken) {
      try {
        await firstValueFrom(this.api.post('/auth/logout', { refreshToken }));
      } catch {
        /* clear locally anyway */
      }
    }
    this.tokens.clear();
    this.user.set(null);
    this.organizationId.set(null);
    this.permissions.set([]);
    await this.router.navigate(['/login']);
  }

  /**
   * Forcibly ends the session on a 401 from the API: clears tokens and
   * in-memory state and redirects to /login. It's important to reset `user`
   * specifically, otherwise guestGuard will consider the user authenticated
   * and redirect them away from /login.
   */
  handleUnauthorized(): void {
    this.tokens.clear();
    this.user.set(null);
    this.organizationId.set(null);
    this.permissions.set([]);
    void this.router.navigate(['/login']);
  }

  /** Ensures a loaded session for the guard: returns true if the user is authenticated. */
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
      this.permissions.set(session.permissions);
      return true;
    } catch {
      this.tokens.clear();
      this.user.set(null);
      this.organizationId.set(null);
      this.permissions.set([]);
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

/** Runs `fn` under a cross-tab lock when the Web Locks API is available. */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request('crm-token-refresh', fn) : fn();
}
