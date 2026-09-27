import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

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
    ],
  },
  { path: '**', redirectTo: '' },
];
