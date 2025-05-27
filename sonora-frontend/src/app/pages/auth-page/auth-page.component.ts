import { Component } from '@angular/core';
import {Router} from "@angular/router";

@Component({
  selector: 'app-auth-page',
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss'
})
export class AuthPageComponent {
  view: 'login' | 'register' = 'login';
  playAnimation = false;
  fadeForms = false;
  isLoading = false;

  constructor(private router: Router) {}

  handleSuccess() {
    this.isLoading = true;
    this.fadeForms = true;
    this.playAnimation = true;

    setTimeout(() => {
      this.navigateToHome();
    }, 3000);
  }

  navigateToHome() {
    this.router.navigate(['/']);
  }
}
