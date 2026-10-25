import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  ALL_AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogDto,
  type Paginated,
} from '@crm/shared';
import { extractErrorMessage } from '../../core/http-error';
import { AuditApi } from './audit.api';

/** Actions grouped for the filter: "auth", "member", "role", … (the part before the dot). */
export interface AuditActionGroup {
  key: string;
  actions: AuditAction[];
}

export interface AuditRow {
  entry: AuditLogDto;
  actor: string;
  changes: AuditChange[];
}

/** One line of the "what changed" details: field, value before and after. */
export interface AuditChange {
  field: string;
  before: string | null;
  after: string | null;
}

const PAGE_SIZE = 20;

/** Audit log business logic. Provided at the AuditPageComponent level (not a singleton). */
@Injectable()
export class AuditPageComponentService {
  private readonly api = inject(AuditApi);
  private readonly translate = inject(TranslateService);

  readonly actions = ALL_AUDIT_ACTIONS;
  readonly groups: AuditActionGroup[] = groupActions(ALL_AUDIT_ACTIONS);

  /** `from`/`to` are calendar dates (YYYY-MM-DD) in the browser's time zone, both inclusive. */
  list(filter: { page: number; action: AuditAction | ''; from: string; to: string }): Promise<Paginated<AuditLogDto>> {
    // A reversed period (from after to) is read as the same range the other way round.
    const [from, to] =
      filter.from && filter.to && filter.from > filter.to ? [filter.to, filter.from] : [filter.from, filter.to];
    return this.api.list({
      page: filter.page,
      limit: PAGE_SIZE,
      action: filter.action || undefined,
      from: from ? startOfLocalDay(from) : undefined,
      to: to ? startOfNextLocalDay(to) : undefined,
    });
  }

  /** What the template shows per entry, computed once per load. */
  toRow(entry: AuditLogDto): AuditRow {
    return { entry, actor: this.actorName(entry), changes: this.changes(entry) };
  }

  actorName(entry: AuditLogDto): string {
    if (!entry.actor) return this.translate.instant('audit.unknownActor');
    const name = `${entry.actor.firstName} ${entry.actor.lastName}`.trim();
    return name || entry.actor.email;
  }

  /** Field-by-field view of the before/after snapshots; fields that didn't change are left out. */
  changes(entry: AuditLogDto): AuditChange[] {
    const before = entry.before ?? {};
    const after = entry.after ?? {};
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return fields.flatMap((field) => {
      const change = {
        field,
        before: field in before ? this.format(field, before[field]) : null,
        after: field in after ? this.format(field, after[field]) : null,
      };
      return change.before !== null && change.before === change.after ? [] : [change];
    });
  }

  /** Turns a failed request into a user-facing message using the given i18n key as fallback. */
  errorMessage(error: unknown, key: string): string {
    return extractErrorMessage(error, this.translate.instant(key));
  }

  private format(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'reason') return this.translate.instant(`auditReason.${String(value)}`);
    if (field === 'permissions' && Array.isArray(value)) {
      return value.length
        ? value.map((p: string) => this.permissionLabel(p)).join(', ')
        : '—';
    }
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  /** "deals.create" → "Deals: Create" in the UI language. */
  private permissionLabel(code: string): string {
    const [group, action] = code.split('.');
    return `${this.translate.instant(`permissionGroup.${group}`)}: ${this.translate.instant(`permissionAction.${action}`)}`;
  }
}

export function groupActions(actions: readonly AuditAction[]): AuditActionGroup[] {
  const groups = new Map<string, AuditActionGroup>();
  for (const action of actions) {
    const key = action.split('.')[0];
    const group = groups.get(key) ?? { key, actions: [] };
    group.actions.push(action);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** "2026-10-25" → ISO of local midnight. */
export function startOfLocalDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** "2026-10-25" → ISO of the next local midnight (exclusive upper bound). */
export function startOfNextLocalDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d + 1).toISOString();
}
