import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../../../shared/ui/language-switcher/language-switcher';
import { LoginComponentService } from './login.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './login.html',
  providers: [LoginComponentService],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(LoginComponentService);

  /** Loader state driving the submit button and the error banner. */
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The sign-in form bound by the template. */
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Submit callback: owns validation and loader state, delegates auth to the service. */
  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.service.login(this.form.getRawValue());
    } catch (e) {
      this.error.set(this.service.toErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
