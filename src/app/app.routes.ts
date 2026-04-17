import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/auth.guard';
import {
  yardAccessGuard,
  gateAccessGuard,
  orderAccessGuard,
  managerAccessGuard,
  operationsAccessGuard,
  yardMapAccessGuard,
} from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'yard-blocks',
    canActivate: [authGuard, yardAccessGuard],
    loadComponent: () =>
      import('./pages/yard-blocks/yard-blocks.component').then(m => m.YardBlocksComponent),
  },
  {
    path: 'containers',
    canActivate: [authGuard, yardAccessGuard],
    loadComponent: () =>
      import('./pages/containers/container-list.component').then(m => m.ContainerListComponent),
  },
  {
    path: 'containers/:containerNumber',
    canActivate: [authGuard, yardAccessGuard],
    loadComponent: () =>
      import('./pages/containers/container-detail.component').then(m => m.ContainerDetailComponent),
  },
  {
    path: 'operations',
    canActivate: [authGuard, operationsAccessGuard],
    loadComponent: () =>
      import('./pages/operations/operations.component').then(m => m.OperationsComponent),
  },
  {
    path: 'delivery-orders',
    canActivate: [authGuard, orderAccessGuard],
    loadComponent: () =>
      import('./pages/delivery-orders/order-list.component').then(m => m.OrderListComponent),
  },
  {
    path: 'delivery-orders/:orderNumber',
    canActivate: [authGuard, orderAccessGuard],
    loadComponent: () =>
      import('./pages/delivery-orders/order-detail.component').then(m => m.OrderDetailComponent),
  },
  {
    path: 'customers',
    canActivate: [authGuard, managerAccessGuard],
    loadComponent: () =>
      import('./pages/customers/customers.component').then(m => m.CustomersComponent),
  },
  {
    path: 'line-operators',
    canActivate: [authGuard, managerAccessGuard],
    loadComponent: () =>
      import('./pages/line-operators/line-operators.component').then(m => m.LineOperatorsComponent),
  },
  {
    path: 'yard-map',
    canActivate: [authGuard, yardMapAccessGuard],
    loadComponent: () =>
      import('./pages/yard-map/yard-map.component').then(m => m.YardMapComponent),
  },
  {
    path: 'user-management',
    canActivate: [authGuard, managerAccessGuard],
    loadComponent: () =>
      import('./pages/users/users.component').then(m => m.UsersComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
