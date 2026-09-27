import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { extractErrorMessage } from '../../core/http-error';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-dvh flex items-center justify-center bg-slate-50 px-4 py-8">
      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
      >
        <h1 class="text-2xl font-semibold text-slate-900">Регистрация</h1>
        <p class="mt-1 text-sm text-slate-500">Создайте организацию и аккаунт владельца</p>

        @if (error()) {
          <div class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {{ error() }}
          </div>
        }

        <div class="mt-5 grid grid-cols-2 gap-3">
          <label class="block text-sm font-medium text-slate-700">
            Имя
            <input formControlName="firstName" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Фамилия
            <input formControlName="lastName" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
        </div>

        <label class="mt-4 block text-sm font-medium text-slate-700">
          Организация
          <input formControlName="organizationName" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </label>

        <label class="mt-4 block text-sm font-medium text-slate-700">
          Email
          <input type="email" formControlName="email" autocomplete="email" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </label>

        <label class="mt-4 block text-sm font-medium text-slate-700">
          Пароль
          <input type="password" formControlName="password" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </label>

        <button
          type="submit"
          [disabled]="loading()"
          class="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {{ loading() ? 'Создаём…' : 'Создать аккаунт' }}
        </button>

        <p class="mt-4 text-center text-sm text-slate-500">
          Уже есть аккаунт?
          <a routerLink="/login" class="font-medium text-indigo-600 hover:underline">Войти</a>
        </p>
      </form>
    </div>
  `,
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    organizationName: ['', [Validators.required, Validators.maxLength(160)]],
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
      await this.auth.register(this.form.getRawValue());
    } catch (e) {
      this.error.set(extractErrorMessage(e, 'Не удалось зарегистрироваться'));
    } finally {
      this.loading.set(false);
    }
  }
}
