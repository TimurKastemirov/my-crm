import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { InvitationPreview } from '@crm/shared';
import { AcceptInviteComponentService } from './accept-invite.service';

@Component({
  selector: 'app-accept-invite',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './accept-invite.html',
  providers: [AcceptInviteComponentService],
})
export class AcceptInviteComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AcceptInviteComponentService);
  private readonly location = inject(Location);
  /** The token travels in the URL fragment (#token=…) so it never reaches server logs. */
  private readonly token =
    new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '').get('token') ?? '';

  protected readonly preview = signal<InvitationPreview | null>(null);
  protected readonly loading = signal(true);
  /** The link itself is unusable (missing, invalid, expired or already used). */
  protected readonly invalid = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  constructor() {
    // Drop the token from the address bar and history once it has been read.
    this.location.replaceState('/invite');
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.token) {
      this.invalid.set(this.service.errorMessage(null, 'invite.missingToken'));
      this.loading.set(false);
      return;
    }
    try {
      const preview = await this.service.preview(this.token);
      this.preview.set(preview);
      // Names are needed only to create a new account.
      if (!preview.userExists) {
        this.form.controls.firstName.addValidators(Validators.required);
        this.form.controls.lastName.addValidators(Validators.required);
        this.form.controls.firstName.updateValueAndValidity();
        this.form.controls.lastName.updateValueAndValidity();
      }
    } catch (e) {
      this.invalid.set(this.service.errorMessage(e, 'invite.invalid'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const preview = this.preview();
    if (!preview) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.service.accept(this.token, preview.userExists, this.form.getRawValue());
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'invite.failed'));
    } finally {
      this.submitting.set(false);
    }
  }
}
