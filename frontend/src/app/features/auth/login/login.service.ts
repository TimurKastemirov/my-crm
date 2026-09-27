import { Injectable, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth.service';
import { extractErrorMessage } from '../../../core/http-error';

/** Логика экрана входа. Провайдится на уровне LoginComponent (не singleton). */
@Injectable()
export class LoginComponentService {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.login(this.form.getRawValue());
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось войти'));
    } finally {
      this.loading.set(false);
    }
  }
}
