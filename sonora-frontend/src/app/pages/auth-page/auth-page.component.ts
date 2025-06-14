import { Component, ViewChild, AfterViewChecked } from '@angular/core';
import { RegisterComponent } from '../register/register.component';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-auth-page',
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss'
})
export class AuthPageComponent implements AfterViewChecked {
  view: 'login' | 'register' = 'login';
  currentStep = 1;

  @ViewChild(RegisterComponent)
  registerComponent?: RegisterComponent;

  constructor(private router: Router, private cdRef: ChangeDetectorRef) {}

  ngAfterViewChecked() {
    if (this.view === 'register' && this.registerComponent && this.currentStep !== this.registerComponent.step) {
      this.currentStep = this.registerComponent.step;
      this.cdRef.detectChanges(); // gaidam current step
    }
  }

  stepLabels = [
    'Izveido kontu un lietotājvārdu',
    'Pastāsti vairāk par sevi',
    'Izvēlies savu foto',
    'Izvēlies iecienītākos žanrus',
    'Atrodi savus mīļākos artistus'
  ];

  playAnimation = false;
  fadeForms = false;
  isLoading = false;

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
