import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'yard-blocks',
    loadComponent: () =>
      import('./pages/yard-blocks/yard-blocks.component').then(m => m.YardBlocksComponent),
  },
  {
    path: 'containers',
    loadComponent: () =>
      import('./pages/containers/container-list.component').then(m => m.ContainerListComponent),
  },
  {
    path: 'containers/:containerNumber',
    loadComponent: () =>
      import('./pages/containers/container-detail.component').then(m => m.ContainerDetailComponent),
  },
  {
    path: 'delivery-orders',
    loadComponent: () =>
      import('./pages/delivery-orders/order-list.component').then(m => m.OrderListComponent),
  },
  {
    path: 'delivery-orders/:orderNumber',
    loadComponent: () =>
      import('./pages/delivery-orders/order-detail.component').then(m => m.OrderDetailComponent),
  },
  {
    path: 'inbound',
    loadComponent: () =>
      import('./pages/lifecycle/inbound.component').then(m => m.InboundComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
