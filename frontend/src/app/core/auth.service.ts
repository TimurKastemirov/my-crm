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
