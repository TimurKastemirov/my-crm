import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth.service';
import { LocaleService } from '../../../core/locale.service';
import { RegisterComponentService } from './register.service';

describe('RegisterComponentService', () => {
  it('creates the account in the language currently on screen', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        RegisterComponentService,
        { provide: AuthService, useValue: { register } },
        { provide: LocaleService, useValue: { lang: signal('uk') } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    const payload = { email: 'a@b.c', password: 'secret123', firstName: 'A', lastName: 'B', organizationName: 'O' };
    await TestBed.inject(RegisterComponentService).register(payload);
    expect(register).toHaveBeenCalledWith({ ...payload, locale: 'uk' });
  });
});
