import { Routes } from '@angular/router';
import { PERMISSIONS } from '@crm/shared';
import { authGuard, guestGuard } from './core/auth.guard';
import { permissionGuard } from './core/permission.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.RegisterComponent),
  },
  {
    // Public: works both signed out and signed in (accepting replaces the current session).
    path: 'invite',
    loadComponent: () => import('./features/auth/accept-invite/accept-invite').then((m) => m.AcceptInviteComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.ShellComponent),
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent) },
      { path: 'contacts', loadComponent: () => import('./features/contacts/contacts-page').then((m) => m.ContactsPageComponent) },
      { path: 'companies', loadComponent: () => import('./features/companies/companies-page').then((m) => m.CompaniesPageComponent) },
      { path: 'leads', loadComponent: () => import('./features/leads/leads-page').then((m) => m.LeadsPageComponent) },
      { path: 'deals', loadComponent: () => import('./features/deals/deals-board').then((m) => m.DealsBoardComponent) },
      { path: 'tasks', loadComponent: () => import('./features/tasks/tasks-page').then((m) => m.TasksPageComponent) },
      { path: 'profile', loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePageComponent) },
      {
        path: 'team',
        canActivate: [permissionGuard(PERMISSIONS.MEMBERS_MANAGE)],
        loadComponent: () => import('./features/team/team-page').then((m) => m.TeamPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
