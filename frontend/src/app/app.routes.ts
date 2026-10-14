import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'register',
    pathMatch: 'full',
  },
  {
    path: 'register',
    title: 'Register — TodoApp',
    loadComponent: () =>
      import('./features/auth/register/register').then((module) => module.Register),
  },
];
