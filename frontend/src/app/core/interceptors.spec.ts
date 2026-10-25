import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor, errorInterceptor } from './interceptors';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage';

describe('errorInterceptor — transparent token refresh', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let tokens: TokenStorage;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorage);
    auth = TestBed.inject(AuthService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    tokens.set({ accessToken: 'old-access', refreshToken: 'refresh-1' });
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  const unauthorized = { status: 401, statusText: 'Unauthorized' };
  /** Lets the refresh promise chain run before asserting the retried request. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('on 401 refreshes once and retries with the new access token', async () => {
    const result = firstValueFrom(http.get<{ ok: boolean }>('/api/v1/deals'));
    const first = backend.expectOne('/api/v1/deals');
    expect(first.request.headers.get('Authorization')).toBe('Bearer old-access');
    first.flush(null, unauthorized);

    const refresh = backend.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush({ accessToken: 'new-access', refreshToken: 'refresh-2' });
    await settle();

    const retry = backend.expectOne('/api/v1/deals');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access');
    retry.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
    expect(tokens.refresh).toBe('refresh-2');
  });

  it('concurrent 401s share a single refresh (refresh tokens are single-use)', async () => {
    const a = firstValueFrom(http.get('/api/v1/a'));
    const b = firstValueFrom(http.get('/api/v1/b'));
    backend.expectOne('/api/v1/a').flush(null, unauthorized);
    backend.expectOne('/api/v1/b').flush(null, unauthorized);

    backend.expectOne('/api/v1/auth/refresh').flush({ accessToken: 'new-access', refreshToken: 'refresh-2' });
    await settle();

    backend.expectOne('/api/v1/a').flush('A');
    backend.expectOne('/api/v1/b').flush('B');
    expect([await a, await b]).toEqual(['A', 'B']);
  });

  it('a failed refresh ends the session', async () => {
    const end = vi.spyOn(auth, 'handleUnauthorized');
    const result = firstValueFrom(http.get('/api/v1/deals'));
    backend.expectOne('/api/v1/deals').flush(null, unauthorized);
    backend.expectOne('/api/v1/auth/refresh').flush(null, unauthorized);

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(end).toHaveBeenCalled();
  });

  it('a retry that is still 401 (e.g. revoked session) ends the session, no loop', async () => {
    const end = vi.spyOn(auth, 'handleUnauthorized');
    const result = firstValueFrom(http.get('/api/v1/deals'));
    backend.expectOne('/api/v1/deals').flush(null, unauthorized);
    backend.expectOne('/api/v1/auth/refresh').flush({ accessToken: 'new-access', refreshToken: 'refresh-2' });
    await settle();
    backend.expectOne('/api/v1/deals').flush(null, unauthorized);

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(end).toHaveBeenCalledTimes(1);
    backend.expectNone('/api/v1/auth/refresh');
  });

  it('a wrong password on sign-in is not treated as an expired session', async () => {
    const end = vi.spyOn(auth, 'handleUnauthorized');
    const result = firstValueFrom(http.post('/api/v1/auth/login', {}));
    backend.expectOne('/api/v1/auth/login').flush(null, unauthorized);
    await expect(result).rejects.toMatchObject({ status: 401 });
    backend.expectNone('/api/v1/auth/refresh');
    expect(end).not.toHaveBeenCalled();
  });

  it('other errors pass through untouched', async () => {
    const result = firstValueFrom(http.get('/api/v1/deals'));
    backend.expectOne('/api/v1/deals').flush(null, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ status: 403 });
    backend.expectNone('/api/v1/auth/refresh');
  });

  describe('review follow-ups', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('a transient refresh failure (5xx / network) fails the request but keeps the session', async () => {
      const end = vi.spyOn(auth, 'handleUnauthorized');
      const result = firstValueFrom(http.get('/api/v1/deals'));
      backend.expectOne('/api/v1/deals').flush(null, unauthorized);
      backend.expectOne('/api/v1/auth/refresh').flush(null, { status: 503, statusText: 'Unavailable' });

      await expect(result).rejects.toMatchObject({ status: 401 });
      expect(end).not.toHaveBeenCalled();
      expect(tokens.refresh).toBe('refresh-1');
    });

    it('a request sent with a token that was replaced meanwhile just retries with the current one', async () => {
      const result = firstValueFrom(http.get('/api/v1/deals'));
      const first = backend.expectOne('/api/v1/deals');
      tokens.set({ accessToken: 'newer-access', refreshToken: 'refresh-9' }); // e.g. password change
      first.flush(null, unauthorized);
      await settle();

      backend.expectNone('/api/v1/auth/refresh');
      const retry = backend.expectOne('/api/v1/deals');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer newer-access');
      retry.flush('ok');
      expect(await result).toBe('ok');
    });

    it('another tab that refreshed while we waited for the lock wins — no second refresh', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        locks: {
          request: async (_name: string, fn: () => Promise<unknown>) => {
            tokens.set({ accessToken: 'tab2-access', refreshToken: 'tab2-refresh' });
            return fn();
          },
        },
      });
      const result = firstValueFrom(http.get('/api/v1/deals'));
      backend.expectOne('/api/v1/deals').flush(null, unauthorized);
      await settle();

      backend.expectNone('/api/v1/auth/refresh');
      const retry = backend.expectOne('/api/v1/deals');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer tab2-access');
      retry.flush('ok');
      expect(await result).toBe('ok');
    });

    it('without a refresh token the session ends', async () => {
      tokens.clear();
      tokens.set({ accessToken: 'only-access', refreshToken: '' });
      const end = vi.spyOn(auth, 'handleUnauthorized');
      const result = firstValueFrom(http.get('/api/v1/deals'));
      backend.expectOne('/api/v1/deals').flush(null, unauthorized);
      await expect(result).rejects.toMatchObject({ status: 401 });
      backend.expectNone('/api/v1/auth/refresh');
      expect(end).toHaveBeenCalled();
    });

    it('signing out while a refresh is in flight does not resurrect the old session', async () => {
      // The request ends with an error here; capture it right away (no unhandled rejection).
      const result = firstValueFrom(http.get('/api/v1/deals')).catch((e: unknown) => e);
      backend.expectOne('/api/v1/deals').flush(null, unauthorized);
      const refresh = backend.expectOne('/api/v1/auth/refresh');
      tokens.clear(); // user signed out in the meantime
      refresh.flush({ accessToken: 'late-access', refreshToken: 'late-refresh' });
      await settle();

      expect(tokens.refresh).toBeNull();
      backend.match('/api/v1/deals').forEach((r) => r.flush(null, unauthorized));
      expect(await result).toMatchObject({ status: 401 });
    });
  });
});
