import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { Permission, RoleSummaryDto } from '@crm/shared';
import { ModalComponent } from '../../shared/ui/modal/modal';
import { RolesPageComponentService, sortRoles, type RoleLock } from './roles-page.service';

@Component({
  selector: 'app-roles-page',
  host: { class: 'block h-full' },
  imports: [ReactiveFormsModule, TranslatePipe, ModalComponent],
  templateUrl: './roles-page.html',
  providers: [RolesPageComponentService],
})
export class RolesPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(RolesPageComponentService);

  protected readonly groups = this.service.groups;
  protected readonly roles = signal<RoleSummaryDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);

  // Editor (modal): `editing` is the role being viewed/edited, null for a new one.
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<RoleSummaryDto | null>(null);
  protected readonly selected = signal<ReadonlySet<Permission>>(new Set());
  protected readonly saving = signal(false);
  protected readonly editorError = signal<string | null>(null);
  /** Why the open role is read-only (i18n key), or null. */
  protected readonly lock = computed<RoleLock>(() => {
    const role = this.editing();
    return role ? this.service.lock(role) : null;
  });
  protected readonly form = this.fb.nonNullable.group({
    // \S: a whitespace-only name is not a name.
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(255)]],
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.roles.set(await this.service.load());
    } catch (e) {
      this.error.set(this.service.errorMessage(e, 'roles.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Translated name for system roles, the stored one for custom roles. */
  protected displayName(role: RoleSummaryDto): string {
    return role.isSystem ? this.translate.instant(`systemRole.${role.code}`) : role.name;
  }

  protected roleLock(role: RoleSummaryDto): RoleLock {
    return this.service.lock(role);
  }

  protected inUse(role: RoleSummaryDto): boolean {
    return this.service.inUse(role);
  }

  protected canGrant(permission: Permission): boolean {
    return this.service.canGrant(permission);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', description: '' });
    this.form.enable();
    this.selected.set(new Set());
    this.editorError.set(null);
    this.editorOpen.set(true);
  }

  protected open(role: RoleSummaryDto): void {
    this.editing.set(role);
    this.form.reset({ name: role.name, description: role.description ?? '' });
    if (this.service.lock(role)) this.form.disable();
    else this.form.enable();
    this.selected.set(new Set(role.permissions));
    this.editorError.set(null);
    this.editorOpen.set(true);
  }

  protected toggle(permission: Permission, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) next.add(permission);
      else next.delete(permission);
      return next;
    });
  }

  protected async save(): Promise<void> {
    if (this.lock()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.editorError.set(null);
    try {
      const saved = await this.service.save(
        this.editing()?.id ?? null,
        this.form.getRawValue(),
        this.selected(),
      );
      this.roles.update((list) =>
        sortRoles(
          list.some((r) => r.id === saved.id)
            ? list.map((r) => (r.id === saved.id ? saved : r))
            : [...list, saved],
        ),
      );
      this.editorOpen.set(false);
    } catch (e) {
      this.editorError.set(this.service.errorMessage(e, 'roles.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(role: RoleSummaryDto): Promise<void> {
    if (!window.confirm(this.translate.instant('roles.deleteConfirm', { name: role.name }))) return;
    this.busyId.set(role.id);
    this.error.set(null);
    try {
      await this.service.remove(role);
      this.roles.update((list) => list.filter((r) => r.id !== role.id));
    } catch (e) {
      const message = this.service.errorMessage(e, 'roles.deleteError');
      await this.load(); // counts may have changed
      this.error.set(message);
    } finally {
      this.busyId.set(null);
    }
  }
}
