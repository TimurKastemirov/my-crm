import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../../shared/ui/language-switcher/language-switcher';
import { ProfilePageComponentService } from './profile-page.service';

@Component({
  selector: 'app-profile-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './profile-page.html',
  providers: [ProfilePageComponentService],
})
export class ProfilePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(ProfilePageComponentService);

  protected readonly user = this.service.user;
  protected readonly timeZone = this.service.timeZone();

  protected readonly savingProfile = signal(false);
  protected readonly profileSaved = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileForm = this.fb.nonNullable.group({
    firstName: [this.user()?.firstName ?? '', [Validators.required, Validators.maxLength(100)]],
    lastName: [this.user()?.lastName ?? '', [Validators.required, Validators.maxLength(100)]],
  });

  protected readonly changingPassword = signal(false);
  protected readonly passwordChanged = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  /** The confirmation doesn't match the new password (marks the field invalid for assistive tech). */
  protected readonly passwordMismatch = signal(false);
  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmPassword: ['', [Validators.required]],
  });

  protected readonly signingOutEverywhere = signal(false);
  protected readonly sessionsError = signal<string | null>(null);

  protected async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    this.profileSaved.set(false);
    this.profileError.set(null);
    try {
      const updated = await this.service.saveProfile(this.profileForm.getRawValue());
      this.profileForm.setValue({ firstName: updated.firstName, lastName: updated.lastName });
      this.profileSaved.set(true);
    } catch (e) {
      this.profileError.set(this.service.errorMessage(e, 'profile.saveError'));
    } finally {
      this.savingProfile.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    this.passwordChanged.set(false);
    this.passwordError.set(null);
    this.passwordMismatch.set(false);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const value = this.passwordForm.getRawValue();
    if (!this.service.passwordsMatch(value)) {
      this.passwordMismatch.set(true);
      this.passwordError.set(this.translate.instant('profile.passwordMismatch'));
      return;
    }
    this.changingPassword.set(true);
    try {
      await this.service.changePassword(value);
      this.passwordForm.reset();
      this.passwordChanged.set(true);
    } catch (e) {
      this.passwordError.set(this.service.errorMessage(e, 'profile.passwordError'));
    } finally {
      this.changingPassword.set(false);
    }
  }

  protected async logoutEverywhere(): Promise<void> {
    if (!window.confirm(this.translate.instant('profile.logoutEverywhereConfirm'))) return;
    this.signingOutEverywhere.set(true);
    this.sessionsError.set(null);
    try {
      await this.service.logoutEverywhere();
    } catch (e) {
      this.sessionsError.set(this.service.errorMessage(e, 'profile.logoutEverywhereError'));
      this.signingOutEverywhere.set(false);
    }
  }
}
