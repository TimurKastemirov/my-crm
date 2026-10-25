import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { SUPPORTED_LOCALES, type AppLocale } from '@crm/shared';
import { AuthService } from '../../../core/auth.service';
import { LocaleService } from '../../../core/locale.service';
import { UsersApi } from '../../../core/users.api';
import { LanguageSwitcherComponent } from './language-switcher';

describe('LanguageSwitcherComponent', () => {
  const lang = signal<AppLocale>('en');
  const locale = {
    lang,
    available: SUPPORTED_LOCALES,
    isSupported: (v: unknown) => (SUPPORTED_LOCALES as readonly unknown[]).includes(v),
    apply: vi.fn((l: AppLocale) => lang.set(l)),
    choose: vi.fn((l: AppLocale) => lang.set(l)),
  };
  const updateSettings = vi.fn();
  const isAuthenticated = signal(false);
  const user = signal<{ locale: string } | null>(null);

  beforeEach(() => {
    lang.set('en');
    isAuthenticated.set(false);
    user.set(null);
    vi.clearAllMocks();
    updateSettings.mockResolvedValue({});
    TestBed.configureTestingModule({
      imports: [LanguageSwitcherComponent],
      providers: [
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: LocaleService, useValue: locale },
        { provide: UsersApi, useValue: { updateSettings } },
        { provide: AuthService, useValue: { isAuthenticated, user } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(LanguageSwitcherComponent);
    fixture.detectChanges();
    return { fixture, select: fixture.nativeElement.querySelector('select') as HTMLSelectElement };
  }

  it('shows the active language, not the first option', async () => {
    lang.set('ru');
    const { fixture, select } = render();
    await fixture.whenStable();
    expect(select.value).toBe('ru');

    lang.set('uk');
    fixture.detectChanges();
    expect(select.value).toBe('uk');
  });

  function pick(select: HTMLSelectElement, value: AppLocale): void {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  it('signed out: remembers the pick for the next sign-in, saves nothing', () => {
    const { select } = render();
    pick(select, 'uk');
    expect(locale.choose).toHaveBeenCalledWith('uk');
    expect(updateSettings).not.toHaveBeenCalled();
  });

  function signIn(profileLocale: AppLocale): void {
    isAuthenticated.set(true);
    user.set({ locale: profileLocale });
  }

  it('signed in: applies the language, saves it and syncs the session', async () => {
    signIn('en');
    const { fixture, select } = render();
    pick(select, 'ru');
    expect(locale.apply).toHaveBeenCalledWith('ru');
    expect(locale.choose).not.toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith({ locale: 'ru' });
    await fixture.whenStable();
    expect(user()?.locale).toBe('ru');
  });

  it('signed in: a failed save returns to the profile language', async () => {
    signIn('en');
    updateSettings.mockRejectedValue(new Error('offline'));
    const { fixture, select } = render();
    pick(select, 'ru');
    await fixture.whenStable();
    expect(lang()).toBe('en');
    expect(user()?.locale).toBe('en');
  });

  it('signed in: only the latest of quick switches decides', async () => {
    signIn('en');
    let failFirst!: (e: Error) => void;
    updateSettings
      .mockImplementationOnce(() => new Promise((_, reject) => (failFirst = reject)))
      .mockResolvedValueOnce({});
    const { fixture, select } = render();
    pick(select, 'ru');
    pick(select, 'uk');
    await fixture.whenStable();
    failFirst(new Error('stale'));
    await fixture.whenStable();
    expect(lang()).toBe('uk');
    expect(user()?.locale).toBe('uk');
  });
});
