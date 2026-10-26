import { Routes } from '@angular/router';
import { authGuard } from './features/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tasks',
    pathMatch: 'full',
  },
  {
    path: 'tasks',
    title: 'My tasks — TodoApp',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tasks/task-list-page/task-list-page.component').then(
        (module) => module.TaskListPageComponent,
      ),
  },
  {
    path: 'login',
    title: 'Sign in — TodoApp',
    loadComponent: () => import('./features/auth/login-page/login-page.component').then((module) => module.LoginPageComponent),
  },
  {
    path: 'register',
    title: 'Register — TodoApp',
    loadComponent: () =>
      import('./features/auth/registration-page/registration-page.component').then((module) => module.RegistrationPageComponent),
  },
];
