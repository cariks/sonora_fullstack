import { Component } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';


@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})

export class RegisterComponent {
  step = 2;
  registerForm: FormGroup;
  loading = false;
  error: string | null = null;

  usernameCheck$ = new Subject<string>();
  usernameAvailable: boolean | null = null;

  // 2 SOLIS

  selectedPhotoFile: File | null = null;
  photoPreviewUrl: string | null = null;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(60),
        Validators.pattern(/^[^%\/\\@?]+$/)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/[A-Z]/),
        Validators.pattern(/[0-9]/)
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordsMatchValidator
    });


    // username pārbaude
    this.usernameCheck$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(username => {
        if (!username || username.length < 4 || !/^[^%\/\\@?]+$/.test(username)) {
          return of(null); // nesūtām uz backend ja tas ir acīmredzami nederīgs
        }
        return this.http.get<{ available: boolean }>(`/api/check-username`, {
          params: { username }
        });
      })
    ).subscribe({
      next: result => {
        this.usernameAvailable = result?.available ?? null;
      },
      error: () => {
        this.usernameAvailable = null;
      }
    });

    // uz katro editu pārbaudam
    this.registerForm.get('username')?.valueChanges.subscribe(value => {
      this.usernameAvailable = null; // atiestatīt
      this.usernameCheck$.next(value);
    });
  }

  passwordsMatchValidator(group: FormGroup) {
    return group.get('password')?.value === group.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  nextStep() {
    if (this.registerForm.valid) {
      this.step = 2; // nākamais solis
    } else {
      this.registerForm.markAllAsTouched();
    }
  }

  // 2 SOLIS

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedPhotoFile = file;

      // Izveidojam priekšskatījumu
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  goToGenresStep(): void {
    if (this.selectedPhotoFile) {
      this.step = 3;
    } else {
      // Ja vēlies, vari atļaut turpināt bez foto
      this.step = 3;
    }
  }

}
