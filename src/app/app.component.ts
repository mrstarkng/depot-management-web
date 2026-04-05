import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'depot-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  template: `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-header p-3">
          <h2 class="m-0 text-xl">Depot Management</h2>
        </div>

        <nav class="sidebar-nav">
          <div class="mb-3">
            <small class="text-color-secondary ml-3">OVERVIEW</small>
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
              <i class="pi pi-home"></i> Dashboard
            </a>
          </div>

          <div class="mb-3">
            <small class="text-color-secondary ml-3">MANAGEMENT</small>
            <a routerLink="/yard-blocks" routerLinkActive="active">
              <i class="pi pi-th-large"></i> Yard Blocks
            </a>
            <a routerLink="/containers" routerLinkActive="active">
              <i class="pi pi-box"></i> Containers
            </a>
            <a routerLink="/delivery-orders" routerLinkActive="active">
              <i class="pi pi-file"></i> Delivery Orders
            </a>
          </div>

          <div class="mb-3">
            <small class="text-color-secondary ml-3">OPERATIONS</small>
            <a routerLink="/inbound" routerLinkActive="active">
              <i class="pi pi-sign-in"></i> Gate In / Out
            </a>
          </div>
        </nav>
      </aside>

      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {
  title = 'Depot Management';
}
