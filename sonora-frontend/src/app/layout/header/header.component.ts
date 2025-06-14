import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  menuOpen = false;
  loggedInUser: any;
  logoutError: string | null = null;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.currentUser$.subscribe(user => {
      this.loggedInUser = user;
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    // Reset error when menu is toggled
    this.logoutError = null;
  }

  logout() {
    this.logoutError = null;
    this.auth.logout().subscribe({
      next: () => {
        window.location.href = '/auth-page';
      },
      error: () => {
        this.logoutError = 'Neizdevās iziet no konta. Lūdzu mēģini vēlreiz.';
      }
    });
  }
}
