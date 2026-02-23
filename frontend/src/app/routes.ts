import { Routes } from '@angular/router';

import { ForgotPasswordComponent } from './auth/forgot-password.component';
import { LoginComponent } from './auth/login.component';
import { ResetPasswordComponent } from './auth/reset-password.component';
import { SignupComponent } from './auth/signup.component';
import { ActivityComponent } from './activity/activity.component';
import { BoxDetailComponent } from './boxes/box-detail.component';
import { BoxesComponent } from './boxes/boxes.component';
import { ConflictsComponent } from './conflicts/conflicts.component';
import { authGuard, guestGuard } from './core/auth.guard';
import { HomeComponent } from './home/home.component';
import { AcceptInviteComponent } from './invites/accept-invite.component';
import { ItemFormComponent } from './items/item-form.component';
import { ScanComponent } from './scan/scan.component';
import { SettingsComponent } from './settings/settings.component';
import { ShellComponent } from './shell/shell.component';
import { TrashComponent } from './trash/trash.component';
import { WarehousesComponent } from './warehouses/warehouses.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'signup', component: SignupComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
  { path: 'invites/:token', component: AcceptInviteComponent, canActivate: [authGuard] },
  { path: 'warehouses', component: WarehousesComponent, canActivate: [authGuard] },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home', component: HomeComponent },
      { path: 'boxes', component: BoxesComponent },
      { path: 'boxes/:id', component: BoxDetailComponent },
      { path: 'items/new', component: ItemFormComponent },
      { path: 'items/:id', component: ItemFormComponent },
      { path: 'scan', component: ScanComponent },
      { path: 'scan/:qrToken', component: ScanComponent },
      { path: 'trash', component: TrashComponent },
      { path: 'activity', component: ActivityComponent },
      { path: 'conflicts', component: ConflictsComponent },
      { path: 'settings', component: SettingsComponent },
      { path: '', pathMatch: 'full', redirectTo: 'home' }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' }
];
