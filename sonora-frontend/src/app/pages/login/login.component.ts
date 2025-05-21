import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;

  rememberMe = false;

  constructor(private auth: AuthService, private router: Router) {
  }

  login() {
    this.auth.getCsrfToken().subscribe(() => {
      this.auth.login({ email: this.email, password: this.password }).subscribe({
        next: () => {
          if (this.rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          } else {
            localStorage.removeItem('rememberMe');
          }

          this.auth.fetchUser().subscribe(() => {
            this.router.navigate(['/']);
          });
        },
        error: (err) => {
          this.error = 'Nepareizs epasts vai parole';
        }
      });
    });
  }
}
