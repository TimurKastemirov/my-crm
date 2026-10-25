import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/auth.service';
import { LocaleService } from './core/locale.service';
import { UsersApi } from './core/users.api';

// `npm test` pins TZ=Europe/Berlin.
describe('App — time zone sync', () => {
  function setup(savedZone: string) {
    const user = signal<{ locale: string; timezone: string } | null>(null);
    const updateSettings = vi.fn().mockResolvedValue({ timezone: 'Europe/Berlin' });
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user } },
        { provide: LocaleService, useValue: { apply: vi.fn(), clearChosenBeforeSignIn: vi.fn() } },
        { provide: UsersApi, useValue: { updateSettings } },
      ],
    });
    const fixture = TestBed.createComponent(App);
    user.set({ locale: 'en', timezone: savedZone });
    return { fixture, user, updateSettings };
  }

  it('saves the browser time zone to the profile when it differs', async () => {
    const { fixture, user, updateSettings } = setup('UTC');
    await fixture.whenStable();
    expect(updateSettings).toHaveBeenCalledWith({ timezone: 'Europe/Berlin' });
    expect(user()?.timezone).toBe('Europe/Berlin');
  });

  it('does nothing when the profile already has the browser time zone', async () => {
    const { fixture, updateSettings } = setup('Europe/Berlin');
    await fixture.whenStable();
    expect(updateSettings).not.toHaveBeenCalled();
  });
});
