import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'depot-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  userName = '';
  password = '';
  rememberMe = true;
  errorMessage = '';
  loading = false;

  readonly devAccounts = [
    { userName: 'manager', label: 'Manager' },
    { userName: 'gateoperator', label: 'Gate Operator' },
    { userName: 'yardplanner', label: 'Yard Planner' },
    { userName: 'orderclerk', label: 'Order Clerk' },
  ];

  private readonly redirectTo: string;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
  ) {
    this.redirectTo = this.route.snapshot.queryParamMap.get('redirectTo') || '/';
  }

  fillCredentials(userName: string) {
    this.userName = userName;
    this.password = 'P@ssw0rd';
    this.errorMessage = '';
  }

  onSubmit() {
    if (!this.userName || !this.password) {
      this.errorMessage = 'Please enter username and password';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.userName, this.password, this.rememberMe).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.redirectTo);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.Message || err.error?.message || 'Login failed. Please check your credentials.';
      },
    });
  }
}
