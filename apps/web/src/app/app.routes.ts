import { Routes } from '@angular/router';
import { adminGuard, authGuard, patientGuard } from './core/auth.guard';
import { AdminDashboardComponent } from './features/admin/admin-dashboard.component';
import { AuthComponent } from './features/auth/auth.component';
import { HomeComponent } from './features/home/home.component';
import { PatientPortalComponent } from './features/patient/patient-portal.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'acceso', component: AuthComponent },
  { path: 'paciente', component: PatientPortalComponent, canActivate: [authGuard, patientGuard] },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: '' },
];
