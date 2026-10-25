import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { UserDto } from '@crm/shared';
import { AuthService } from '../../core/auth.service';
import { UsersApi } from '../../core/users.api';
import { ProfilePageComponentService } from './profile-page.service';

describe('ProfilePageComponentService', () => {
  const user = signal<Partial<UserDto> | null>({ id: 'u1', firstName: 'Old', lastName: 'Name' });
  const api = { updateProfile: vi.fn(), changePassword: vi.fn() };
  const auth = { user, useTokens: vi.fn(), logoutEverywhere: vi.fn() };
  let service: ProfilePageComponentService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ProfilePageComponentService,
        { provide: UsersApi, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    service = TestBed.inject(ProfilePageComponentService);
  });

  it('saves trimmed names and refreshes the session user (header shows the new name)', async () => {
    const updated = { id: 'u1', firstName: 'New', lastName: 'Person' };
    api.updateProfile.mockResolvedValue(updated);
    await service.saveProfile({ firstName: ' New ', lastName: ' Person ' });
    expect(api.updateProfile).toHaveBeenCalledWith({ firstName: 'New', lastName: 'Person' });
    expect(user()).toEqual({ id: 'u1', firstName: 'New', lastName: 'Person' });
  });

  it('checks that the new password and its confirmation match', () => {
    expect(service.passwordsMatch({ newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })).toBe(true);
    expect(service.passwordsMatch({ newPassword: 'abcdefgh', confirmPassword: 'abcdefgX' })).toBe(false);
  });

  it('after a password change keeps this session on the new token pair', async () => {
    const tokens = { accessToken: 'a', refreshToken: 'r' };
    api.changePassword.mockResolvedValue(tokens);
    await service.changePassword({ currentPassword: 'old-pass-1', newPassword: 'new-pass-1' });
    expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'old-pass-1', newPassword: 'new-pass-1' });
    expect(auth.useTokens).toHaveBeenCalledWith(tokens);
  });

  it('does not touch the session when the password change fails', async () => {
    api.changePassword.mockRejectedValue({ error: { message: 'The current password is incorrect' } });
    await expect(service.changePassword({ currentPassword: 'x', newPassword: 'new-pass-1' })).rejects.toBeTruthy();
    expect(auth.useTokens).not.toHaveBeenCalled();
  });
});
