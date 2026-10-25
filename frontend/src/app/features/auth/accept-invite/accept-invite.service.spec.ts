import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { AppLocale } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { LocaleService } from '../../../core/locale.service';
import { AcceptInviteComponentService } from './accept-invite.service';

describe('AcceptInviteComponentService', () => {
  function setup(chosen: AppLocale | null) {
    const acceptInvitation = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        AcceptInviteComponentService,
        { provide: AuthService, useValue: { acceptInvitation } },
        { provide: LocaleService, useValue: { lang: signal('uk'), chosenBeforeSignIn: () => chosen } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    return { service: TestBed.inject(AcceptInviteComponentService), acceptInvitation };
  }
  const form = { firstName: ' Ann ', lastName: ' Lee ', password: 'secret123' };

  it('a new account sends its names and the language on screen', async () => {
    const { service, acceptInvitation } = setup(null);
    await service.accept('tok', false, form);
    expect(acceptInvitation).toHaveBeenCalledWith({
      token: 'tok',
      password: 'secret123',
      firstName: 'Ann',
      lastName: 'Lee',
      locale: 'uk',
    });
  });

  it('an existing account sends only the password and a language picked on this screen', async () => {
    const { service, acceptInvitation } = setup('en');
    await service.accept('tok', true, form);
    expect(acceptInvitation).toHaveBeenCalledWith({ token: 'tok', password: 'secret123', locale: 'en' });
  });

  it('an existing account without a pick keeps its profile language', async () => {
    const { service, acceptInvitation } = setup(null);
    await service.accept('tok', true, form);
    expect(acceptInvitation).toHaveBeenCalledWith({ token: 'tok', password: 'secret123', locale: undefined });
  });
});
