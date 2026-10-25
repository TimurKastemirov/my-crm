import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { LocaleService } from './locale.service';

describe('LocaleService — language picked before sign-in', () => {
  let service: LocaleService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslateService({ fallbackLang: 'en' })] });
    service = TestBed.inject(LocaleService);
  });

  afterEach(() => localStorage.clear());

  it('has no pick until the user chooses a language while signed out', () => {
    expect(service.chosenBeforeSignIn()).toBeNull();
  });

  it('choose() applies the language and remembers it for the next sign-in', () => {
    service.choose('uk');
    expect(service.lang()).toBe('uk');
    expect(service.chosenBeforeSignIn()).toBe('uk');
  });

  it('apply() alone (e.g. the profile language) is not an explicit pick', () => {
    service.apply('ru');
    expect(service.lang()).toBe('ru');
    expect(service.chosenBeforeSignIn()).toBeNull();
  });

  it('the pick is consumed once a session applied its language', () => {
    service.choose('ru');
    service.clearChosenBeforeSignIn();
    expect(service.chosenBeforeSignIn()).toBeNull();
  });

  it('ignores a corrupted stored pick', () => {
    localStorage.setItem('crm.localeChosen', 'de');
    expect(service.chosenBeforeSignIn()).toBeNull();
  });
});
