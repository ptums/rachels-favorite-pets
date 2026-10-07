import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Session } from './session';

export const routes: Routes = [
  {
    path: '',
    title: "Rachel's Favorite Pets",
    loadComponent: () => import('./gallery/gallery').then((m) => m.Gallery),
  },
  {
    path: 'login',
    title: "Log in · Rachel's Favorite Pets",
    loadComponent: () => import('./login/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    title: "Sign up · Rachel's Favorite Pets",
    // Signup only exists in accounts mode.
    canMatch: [() => inject(Session).canSignup() || inject(Router).createUrlTree(['/login'])],
    loadComponent: () => import('./signup/signup').then((m) => m.Signup),
  },
  { path: '**', redirectTo: '' },
];
