import { Component } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import confetti from 'canvas-confetti';


@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})

export class RegisterComponent {
  public step = 1;
  registerForm: FormGroup;
  additionalInfoForm: FormGroup;
  loading = false;
  error: string | null = null;
  maxDate: string;

  emailCheck$ = new Subject<string>();
  emailAvailable: boolean | null = null;

  usernameCheck$ = new Subject<string>();
  usernameAvailable: boolean | null = null;

  // 2 SOLIS

  tempPhotoPath: string | null = null;

  selectedPhotoFile: File | null = null;
  photoPreviewUrl: string | null = null;
  photoError: string | null = null;

  // 3 SOLIS

  genres: any[] = [];
  selectedGenres: number[] = [];
  genreColors: Record<number, string> = {};
  genreColorPool: string[] = ['#E33205', '#2542C3', '#0B266C', '#D86400', '#1DA10E', '#E2108E', '#1593D2', '#777777', '#EB1F32', '#081B4C', '#E8125D'];

  // 4 SOLIS

  artists: any[] = [];
  selectedArtists: number[] = [];

  constructor(private fb: FormBuilder, private http: HttpClient) {
    // Set max date to today
    const today = new Date();
    this.maxDate = today.toISOString().split('T')[0];

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

    // Add new form for additional info
    this.additionalInfoForm = this.fb.group({
      display_name: ['', [Validators.maxLength(100)]],
      date_of_birth: [''],
      bio: ['', [Validators.maxLength(5000)]]
    });

    // epasts pārbaude
    this.emailCheck$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(email => {
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) return of(null);
        return this.http.get<{ available: boolean }>('/api/check-email', {
          params: { email }
        });
      })
    ).subscribe({
      next: result => {
        this.emailAvailable = result?.available ?? null;
      },
      error: () => {
        this.emailAvailable = null;
      }
    });

    this.registerForm.get('email')?.valueChanges.subscribe(value => {
      this.emailAvailable = null;
      this.emailCheck$.next(value);
    });


    // username pārbaude
    this.usernameCheck$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(username => {
        if (!username || username.length < 3 || !/^[^%\/\\@?]+$/.test(username)) {
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
      this.step = 2;
    } else {
      this.registerForm.markAllAsTouched();
    }
  }

  // 2 SOLIS
  photoServerPath: string | null = null;

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      const allowedTypes = ['image/png', 'image/jpeg'];
      const maxSize = 10 * 1024 * 1024;

      if (!allowedTypes.includes(file.type)) {
        this.photoError = 'Nepareizs formāts. Atļauti tikai PNG vai JPG.';
        return;
      }

      if (file.size > maxSize) {
        this.photoError = 'Attēls ir pārāk liels. Maksimālais izmērs – 10MB.';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreviewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('photo', file);

      this.http.post('/api/upload-temp-photo', formData, {
        responseType: 'text'
      }).subscribe({
        next: (res: string) => {
          const match = res.match(/storage\/[^\s<"]+/);
          if (match) {
            this.tempPhotoPath = match[0];
            this.photoError = null;
            console.log('📸 Uploaded temp photo:', this.tempPhotoPath);
          } else {
            this.photoError = 'Nevarēja nolasīt augšupielādēto attēlu.';
          }
        },
        error: err => {
          this.photoError = 'Neizdevās augšupielādēt attēlu.';
          console.error(err);
        }
      });
    }
  }





  goToGenresStep(): void {
    if (this.selectedPhotoFile) {
      this.step = 4;
    } else {
      // Ja vēlies, vari atļaut turpināt bez foto
      this.step = 4;
    }
  }


  // 3 SOLIS
  ngOnInit() {
    this.loadGenres();
  }

  loadGenres(): void {
    this.http.get<any[]>('/api/genres').subscribe(genres => {
      this.genres = genres;

      genres.forEach((genre, index) => {
        const color = this.genreColorPool[index % this.genreColorPool.length];
        this.genreColors[genre.id] = color;
      });
    });
  }

  toggleGenre(genreId: number): void {
    if (this.selectedGenres.includes(genreId)) {
      this.selectedGenres = this.selectedGenres.filter(id => id !== genreId);
    } else {
      this.selectedGenres.push(genreId);
    }
  }

  goToArtistsStep(): void {
    if (this.selectedGenres.length >= 3) {
      this.loadSuggestedArtists();
      this.step = 5;
    }
  }

  // 4 SOLIS

  loadSuggestedArtists(): void {
    console.log('Nosūtām žanrus:', this.selectedGenres);

    this.http.post<any[]>('/api/suggested-artists', {
      genre_ids: this.selectedGenres
    }).subscribe(artists => {
      console.log('Saņemti artisti:', artists);
      this.artists = artists;
    });
  }


  toggleArtist(artistId: number): void {
    if (this.selectedArtists.includes(artistId)) {
      this.selectedArtists = this.selectedArtists.filter(id => id !== artistId);
    } else {
      this.selectedArtists.push(artistId);
    }
  }

  userEmail: string = '';
  userPassword: string = '';
  autoLoginLoading = false;

  submitRegistration(): void {
    if (!this.registerForm.valid || this.selectedGenres.length < 3) return;

    const formData = new FormData();
    formData.append('username', this.registerForm.value.username);
    formData.append('email', this.registerForm.value.email);
    formData.append('password', this.registerForm.value.password);

    // Add additional info if provided
    if (this.additionalInfoForm.value.display_name) {
      formData.append('display_name', this.additionalInfoForm.value.display_name);
    }
    if (this.additionalInfoForm.value.date_of_birth) {
      formData.append('date_of_birth', this.additionalInfoForm.value.date_of_birth);
    }
    if (this.additionalInfoForm.value.bio) {
      formData.append('bio', this.additionalInfoForm.value.bio);
    }

    if (this.tempPhotoPath) {
      formData.append('photo_path', this.tempPhotoPath);
    }

    this.selectedGenres.forEach(id => {
      formData.append('favorite_genres[]', String(id));
    });

    this.selectedArtists.forEach(id => {
      formData.append('favorite_artists[]', String(id));
    });

    this.loading = true;

    this.http.get('http://127.0.0.1:8000/sanctum/csrf-cookie', { withCredentials: true })
      .subscribe(() => {
        this.http.post<{ user_id: number }>('http://127.0.0.1:8000/api/register', formData, { withCredentials: true })
          .subscribe({
            next: (res) => {
              this.userEmail = this.registerForm.value.email;
              this.userPassword = this.registerForm.value.password;
              this.loading = false;
              this.step = 6;

              confetti({
                particleCount: 150,
                spread: 90,
                origin: {
                  x: 0.2,
                  y: 0.5
                },
                angle: 90,
              });

              this.loading = false;
            },
            error: (err) => {
              this.error = 'Neizdevās reģistrācija.';
              console.error(err);
            }
          });
      });
  }

  // 5 SOLIS

  autoLogin() {
    this.autoLoginLoading = true;

    const loginData = {
      email: this.userEmail,
      password: this.userPassword
    };

    this.http.get('http://127.0.0.1:8000/sanctum/csrf-cookie', { withCredentials: true }).subscribe(() => {
      this.http.post('/api/login', loginData, { withCredentials: true }).subscribe({
        next: () => {
          // uz galveno lapu
          window.location.href = '/home';

        },
        error: (err) => {
          this.autoLoginLoading = false;
          console.error('Neizdevās pieslēgties:', err);
          alert('Neizdevās automātiski pieslēgties');

        }
      });
    });
  }

  // Add new method to handle additional info step
  goToPhotoStep() {
    this.step = 3;
  }

}
