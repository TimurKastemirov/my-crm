import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { SUPPORTED_LOCALES, type AppLocale } from '@crm/shared';

const STORAGE_KEY = 'crm.locale';
/** A language picked explicitly while signed out; sent with the next sign-in so it wins over the profile. */
const CHOSEN_KEY = 'crm.localeChosen';

/** Maps our short locale to the Angular LOCALE_ID used by the currency/date pipes. */
const NG_LOCALE: Record<AppLocale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uk: 'uk-UA',
};

/**
 * Owns the active UI language: drives ngx-translate, exposes a reactive
 * `locale` string for the currency pipe, and remembers the choice per browser.
 * The authoritative per-user value lives on the backend (UserDto.locale) and is
 * applied on session load; the switcher writes it back.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly translate = inject(TranslateService);

  readonly lang = signal<AppLocale>('en');
  /** e.g. 'ru-RU' — pass to the currency pipe so amounts format per language. */
  readonly locale = computed(() => NG_LOCALE[this.lang()]);
  readonly available = SUPPORTED_LOCALES;

  /** Bootstraps ngx-translate and loads the initial language (storage → browser → en). */
  init(): Promise<unknown> {
    this.translate.addLangs([...SUPPORTED_LOCALES]);
    this.translate.setFallbackLang('en');
    const lang = this.stored() ?? this.fromBrowser() ?? 'en';
    this.lang.set(lang);
    this.persistLocal(lang);
    return firstValueFrom(this.translate.use(lang));
  }

  /** Switches the UI language now and remembers it in this browser. */
  apply(lang: AppLocale): void {
    if (!this.isSupported(lang) || lang === this.lang()) return;
    this.lang.set(lang);
    this.translate.use(lang).subscribe();
    this.persistLocal(lang);
  }

  /** An explicit pick while signed out: applied now and remembered until the next sign-in. */
  choose(lang: AppLocale): void {
    this.apply(lang);
    try {
      localStorage.setItem(CHOSEN_KEY, lang);
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }

  /** The language picked before signing in, if any — to send with login/accept. */
  chosenBeforeSignIn(): AppLocale | null {
    try {
      const v = localStorage.getItem(CHOSEN_KEY);
      return this.isSupported(v) ? v : null;
    } catch {
      return null;
    }
  }

  /** Once a session has applied its language, the pre-sign-in pick has been consumed. */
  clearChosenBeforeSignIn(): void {
    try {
      localStorage.removeItem(CHOSEN_KEY);
    } catch {
      /* ignore */
    }
  }

  isSupported(value: unknown): value is AppLocale {
    return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
  }

  private stored(): AppLocale | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return this.isSupported(v) ? v : null;
    } catch {
      return null;
    }
  }

  private fromBrowser(): AppLocale | null {
    const v = this.translate.getBrowserLang();
    return this.isSupported(v) ? v : null;
  }

  private persistLocal(lang: AppLocale): void {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }
}
