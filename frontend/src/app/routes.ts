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
import { warehouseAdministratorGuard } from './core/warehouse-admin.guard';
import { warehouseEntryGuard, warehouseSelectedGuard } from './core/warehouse.guard';
import { HomeComponent } from './home/home.component';
import { AcceptInviteComponent } from './invites/accept-invite.component';
import { ItemFormComponent } from './items/item-form.component';
import { IntakeBatchesComponent } from './items/intake-batches.component';
import { ItemIntakeBatchComponent } from './items/item-intake-batch.component';
import { ItemPhotoCaptureComponent } from './items/item-photo-capture.component';
import { MembersComponent } from './members/members.component';
import { ScanComponent } from './scan/scan.component';
import { SettingsComponent } from './settings/settings.component';
import { ShellComponent } from './shell/shell.component';
import { TrashComponent } from './trash/trash.component';
import { WarehousesComponent } from './warehouses/warehouses.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'signup', component: SignupComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
  { path: 'invites/:token', component: AcceptInviteComponent, canActivate: [authGuard] },
  { path: 'warehouses', redirectTo: 'app/warehouses', pathMatch: 'full' },
  {
    path: 'app',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'warehouses', component: WarehousesComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'home', component: HomeComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'boxes', component: BoxesComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'boxes/:id', component: BoxDetailComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'batches', component: IntakeBatchesComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'batches/:batchId', component: ItemIntakeBatchComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'items/new', component: ItemFormComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'items/intake-batch', redirectTo: 'batches', pathMatch: 'full' },
      { path: 'items/from-photo', component: ItemPhotoCaptureComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'items/:id', component: ItemFormComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'scan', component: ScanComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'scan/:qrToken', component: ScanComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'trash', component: TrashComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'activity', component: ActivityComponent, canActivate: [warehouseSelectedGuard] },
      { path: 'conflicts', component: ConflictsComponent, canActivate: [warehouseSelectedGuard, warehouseAdministratorGuard] },
      { path: 'members', component: MembersComponent, canActivate: [warehouseSelectedGuard, warehouseAdministratorGuard] },
      { path: 'settings', component: SettingsComponent, canActivate: [warehouseSelectedGuard, warehouseAdministratorGuard] },
      { path: '', pathMatch: 'full', canActivate: [warehouseEntryGuard], component: WarehousesComponent }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' }
];
