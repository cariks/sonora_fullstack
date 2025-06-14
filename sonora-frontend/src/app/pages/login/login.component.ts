import {Component, EventEmitter, Input, Output} from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  @Input() loading: boolean = false;
  @Output() success = new EventEmitter<void>();

  email = '';
  password = '';
  error: string | null = null;
  rememberMe = false;

  constructor(private auth: AuthService) {}

  login() {
    // Reset error
    this.error = null;

    // Check if fields are empty
    if (!this.email.trim() || !this.password.trim()) {
      this.error = 'Lūdzu aizpildi visus laukus';
      return;
    }

    this.auth.getCsrfToken().subscribe(() => {
      this.auth.login({ email: this.email, password: this.password }).subscribe({
        next: () => {
          if (this.rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          } else {
            localStorage.removeItem('rememberMe');
          }

          this.auth.fetchUser().subscribe(() => {
            this.success.emit();
          });
        },
        error: () => {
          this.error = 'Nepareizs epasts vai parole';
        }
      });
    });
  }
}
