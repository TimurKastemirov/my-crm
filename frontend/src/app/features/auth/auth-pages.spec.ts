import { TestBed } from '@angular/core/testing';
import { signal, type Type } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SUPPORTED_LOCALES } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { LocaleService } from '../../core/locale.service';
import { UsersApi } from '../../core/users.api';
import { LoginComponent } from './login/login';
import { RegisterComponent } from './register/register';
import { AcceptInviteComponent } from './accept-invite/accept-invite';

/** Signed-out pages must offer the language switcher, otherwise a language can't be picked before sign-in. */
describe('signed-out pages', () => {
  const pages: Array<[string, Type<unknown>]> = [
    ['login', LoginComponent],
    ['register', RegisterComponent],
    ['accept invite', AcceptInviteComponent],
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: ActivatedRoute, useValue: { snapshot: { fragment: null } } },
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(false), user: signal(null), previewInvitation: vi.fn() },
        },
        {
          provide: LocaleService,
          useValue: {
            lang: signal('en'),
            available: SUPPORTED_LOCALES,
            isSupported: () => true,
            chosenBeforeSignIn: () => null,
          },
        },
        { provide: UsersApi, useValue: { updateSettings: vi.fn() } },
      ],
    });
  });

  it.each(pages)('%s page shows the language switcher', async (_name, page) => {
    const fixture = TestBed.createComponent(page);
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-language-switcher select')).not.toBeNull();
  });
});
