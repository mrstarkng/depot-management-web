import { Component, computed, Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { filter, map, startWith } from 'rxjs';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
  visible: Signal<boolean>;
}

@Component({
  selector: 'depot-root',
  standalone: true,
  imports: [RouterModule, ToastModule],
  providers: [MessageService],
  templateUrl: './app.component.html',
})
export class AppComponent {
  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  readonly authService: AuthService;
  readonly isAuthRoute;

  navItems: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: 'pi pi-home', exact: true, visible: computed(() => this.authService.isAuthenticated()) },
    { path: '/yard-blocks', label: 'Yard Blocks', icon: 'pi pi-th-large', visible: computed(() => this.authService.canManageYard()) },
    { path: '/containers', label: 'Containers', icon: 'pi pi-box', visible: computed(() => this.authService.canManageYard()) },
    {
      path: '/operations',
      label: 'Inbound / Outbound',
      icon: 'pi pi-arrows-h',
      visible: computed(() => this.authService.canGateInOut() || this.authService.canManageYard()),
    },
    { path: '/delivery-orders', label: 'Delivery Orders', icon: 'pi pi-file-edit', visible: computed(() => this.authService.canManageOrders()) },
    {
      path: '/yard-map',
      label: 'Yard Map',
      icon: 'pi pi-map',
      visible: computed(() => this.authService.canGateInOut() || this.authService.canManageYard()),
    },
  ];

  refItems: NavItem[] = [
    { path: '/customers', label: 'Customers', icon: 'pi pi-users', visible: computed(() => this.authService.isManager()) },
    { path: '/line-operators', label: 'Line Operators', icon: 'pi pi-truck', visible: computed(() => this.authService.isManager()) },
  ];

  adminItems: NavItem[] = [
    { path: '/user-management', label: 'User Management', icon: 'pi pi-shield', visible: computed(() => this.authService.isManager()) },
  ];

  visibleNavItems = computed(() => this.navItems.filter(item => item.visible()));
  visibleRefItems = computed(() => this.refItems.filter(item => item.visible()));
  visibleAdminItems = computed(() => this.adminItems.filter(item => item.visible()));

  constructor(router: Router, authService: AuthService) {
    this.authService = authService;
    const currentUrl = toSignal(
      router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        startWith(null),
        map(() => router.url)
      ),
      { initialValue: router.url }
    );
    this.isAuthRoute = computed(() => currentUrl().startsWith('/login'));
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.mobileMenuOpen.set(false));
  }

  logout() {
    this.authService.logout();
  }
}
