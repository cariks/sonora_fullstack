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

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.auth.getUser().subscribe({
      next: (res) => this.loggedInUser = res,
      error: (err) => console.error('Neizdevās ielādēt lietotāju:', err)
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  logout() {
    this.auth.logout().subscribe(() => window.location.href = '/login');
  }
}
