import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiClient } from './api-client';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage';

describe('AuthService.logoutEverywhere', () => {
  function setup(post: () => unknown) {
    const tokens = { clear: vi.fn(), set: vi.fn(), access: 'a', refresh: 'r' };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ApiClient, useValue: { post: vi.fn(post) } },
        { provide: TokenStorage, useValue: tokens },
      ],
    });
    const auth = TestBed.inject(AuthService);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    auth.user.set({ id: 'u1' } as never);
    return { auth, tokens, navigate };
  }

  it('ends all sessions on the server, then this one locally', async () => {
    const { auth, tokens, navigate } = setup(() => of(undefined));
    await auth.logoutEverywhere();
    expect(tokens.clear).toHaveBeenCalled();
    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('keeps the session when the server call fails (so the user can retry)', async () => {
    const { auth, tokens, navigate } = setup(() => throwError(() => new Error('offline')));
    await expect(auth.logoutEverywhere()).rejects.toThrow('offline');
    expect(tokens.clear).not.toHaveBeenCalled();
    expect(auth.user()).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});
