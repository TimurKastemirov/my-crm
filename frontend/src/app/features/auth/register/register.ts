import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { RegisterComponentService } from './register.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.html',
  providers: [RegisterComponentService],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(RegisterComponentService);

  /** Loader state driving the submit button and the error banner. */
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The registration form bound by the template. */
  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    organizationName: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Submit callback: owns validation and loader state, delegates registration to the service. */
  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.service.register(this.form.getRawValue());
    } catch (e) {
      this.error.set(this.service.toErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
