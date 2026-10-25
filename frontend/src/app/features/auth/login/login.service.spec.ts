import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import type { AppLocale } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { LocaleService } from '../../../core/locale.service';
import { LoginComponentService } from './login.service';

describe('LoginComponentService', () => {
  function setup(chosen: AppLocale | null) {
    const login = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        LoginComponentService,
        { provide: AuthService, useValue: { login } },
        { provide: LocaleService, useValue: { chosenBeforeSignIn: () => chosen } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    return { service: TestBed.inject(LoginComponentService), login };
  }

  it('sends a language picked before signing in, so it wins over the profile', async () => {
    const { service, login } = setup('en');
    await service.login({ email: 'a@b.c', password: 'secret123' });
    expect(login).toHaveBeenCalledWith({ email: 'a@b.c', password: 'secret123', locale: 'en' });
  });

  it('sends no language when none was picked (the profile language applies)', async () => {
    const { service, login } = setup(null);
    await service.login({ email: 'a@b.c', password: 'secret123' });
    expect(login).toHaveBeenCalledWith({ email: 'a@b.c', password: 'secret123', locale: undefined });
  });
});
