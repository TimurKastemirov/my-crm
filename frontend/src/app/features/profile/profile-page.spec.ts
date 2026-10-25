import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { SUPPORTED_LOCALES } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { LocaleService } from '../../core/locale.service';
import { UsersApi } from '../../core/users.api';
import { ProfilePageComponent } from './profile-page';

describe('ProfilePageComponent — change password', () => {
  const changePassword = vi.fn();

  beforeEach(() => {
    changePassword.mockReset();
    TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        provideTranslateService({ fallbackLang: 'en' }),
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B' }),
            isAuthenticated: signal(true),
            useTokens: vi.fn(),
          },
        },
        { provide: UsersApi, useValue: { changePassword, updateProfile: vi.fn(), updateSettings: vi.fn() } },
        {
          provide: LocaleService,
          useValue: { lang: signal('en'), available: SUPPORTED_LOCALES, isSupported: () => true },
        },
      ],
    });
  });

  function fill(fixture: { nativeElement: HTMLElement }, id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('a mismatched confirmation is reported on the field and nothing is sent', async () => {
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    fill(fixture, 'profile-current-password', 'old-pass-1');
    fill(fixture, 'profile-new-password', 'new-pass-1');
    fill(fixture, 'profile-confirm-password', 'new-pass-2');
    (fixture.nativeElement.querySelector('#profile-current-password') as HTMLInputElement).form!.requestSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(changePassword).not.toHaveBeenCalled();
    const confirm = fixture.nativeElement.querySelector('#profile-confirm-password') as HTMLInputElement;
    expect(confirm.getAttribute('aria-invalid')).toBe('true');
    expect(confirm.getAttribute('aria-describedby')).toBe('profile-password-error');
    expect(fixture.nativeElement.querySelector('#profile-password-error')).not.toBeNull();
  });
});
