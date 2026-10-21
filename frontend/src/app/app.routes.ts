import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    title: 'Sign in — TodoApp',
    loadComponent: () => import('./features/auth/login/login').then((module) => module.Login),
  },
  {
    path: 'register',
    title: 'Register — TodoApp',
    loadComponent: () =>
      import('./features/auth/register/register').then((module) => module.Register),
  },
];
