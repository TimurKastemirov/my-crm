import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { PERMISSIONS, type Permission, type RoleSummaryDto } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { RolesApi } from './roles.api';
import { RolesPageComponent } from './roles-page';

const role = (over: Partial<RoleSummaryDto>): RoleSummaryDto => ({
  id: 'r1',
  organizationId: 'o1',
  name: 'Sales',
  code: 'sales',
  isSystem: false,
  description: null,
  permissions: [PERMISSIONS.DEALS_READ],
  memberCount: 0,
  invitationCount: 0,
  assignedToMe: false,
  createdAt: '',
  updatedAt: '',
  ...over,
});

describe('RolesPageComponent', () => {
  const mine: Permission[] = [PERMISSIONS.ROLES_MANAGE, PERMISSIONS.DEALS_READ];
  const api = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };

  async function render(roles: RoleSummaryDto[]) {
    api.list.mockResolvedValue(roles);
    TestBed.configureTestingModule({
      imports: [RolesPageComponent],
      providers: [
        provideTranslateService({ fallbackLang: 'en' }),
        { provide: RolesApi, useValue: api },
        { provide: AuthService, useValue: { can: (p: Permission) => mine.includes(p) } },
      ],
    });
    const fixture = TestBed.createComponent(RolesPageComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => vi.clearAllMocks());

  it('a locked role opens read-only: no save, disabled inputs and checkboxes', async () => {
    const { fixture, host } = await render([role({ assignedToMe: true })]);
    (host.querySelector('li button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((host.querySelector('#role-name') as HTMLInputElement).disabled).toBe(true);
    expect((host.querySelector('#perm-deals\\.read') as HTMLInputElement).disabled).toBe(true);
    expect(host.querySelector('app-modal button[type="submit"]')).toBeNull();
  });

  it('only permissions you hold can be ticked on an editable role', async () => {
    const { fixture, host } = await render([role({})]);
    (host.querySelector('li button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((host.querySelector('#perm-deals\\.read') as HTMLInputElement).disabled).toBe(false);
    expect((host.querySelector('#perm-deals\\.delete') as HTMLInputElement).disabled).toBe(true);
  });

  it('delete is disabled while the role is in use', async () => {
    const { host } = await render([role({ memberCount: 2 })]);
    const del = host.querySelectorAll('li button')[1] as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(del.getAttribute('aria-describedby')).toBe('role-in-use-r1');
  });

  it('a whitespace-only name is not submitted', async () => {
    const { fixture, host } = await render([]);
    (host.querySelector('h1 + button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const name = host.querySelector('#role-name') as HTMLInputElement;
    name.value = '   ';
    name.dispatchEvent(new Event('input'));
    (name.form as HTMLFormElement).requestSubmit();
    await fixture.whenStable();
    expect(api.create).not.toHaveBeenCalled();
  });
});
