import { Routes } from '@angular/router';

import { ForgotPasswordComponent } from './auth/forgot-password.component';
import { LoginComponent } from './auth/login.component';
import { ResetPasswordComponent } from './auth/reset-password.component';
import { SignupComponent } from './auth/signup.component';
import { authGuard, guestGuard } from './core/auth.guard';
import { ShellComponent } from './shell/shell.component';
import { WarehousesComponent } from './warehouses/warehouses.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'signup', component: SignupComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
  { path: 'warehouses', component: WarehousesComponent, canActivate: [authGuard] },
  { path: 'app', component: ShellComponent, canActivate: [authGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'login' }
];
