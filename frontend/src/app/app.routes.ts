import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'contacts', loadComponent: () => import('./features/placeholder').then((m) => m.Placeholder) },
      { path: 'companies', loadComponent: () => import('./features/placeholder').then((m) => m.Placeholder) },
      { path: 'leads', loadComponent: () => import('./features/placeholder').then((m) => m.Placeholder) },
      { path: 'deals', loadComponent: () => import('./features/placeholder').then((m) => m.Placeholder) },
      { path: 'tasks', loadComponent: () => import('./features/placeholder').then((m) => m.Placeholder) },
    ],
  },
  { path: '**', redirectTo: '' },
];
