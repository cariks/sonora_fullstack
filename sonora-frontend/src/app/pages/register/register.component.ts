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
  public step = 1;
  registerForm: FormGroup;
  loading = false;
  error: string | null = null;

  emailCheck$ = new Subject<string>();
  emailAvailable: boolean | null = null;

  usernameCheck$ = new Subject<string>();
  usernameAvailable: boolean | null = null;

  // 2 SOLIS

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

      const allowedTypes = ['image/png', 'image/jpeg'];
      const maxSize = 10 * 1024 * 1024; // 10MB

      // validācija
      if (!allowedTypes.includes(file.type)) {
        this.photoError = 'Nepareizs formāts. Atļauti tikai PNG vai JPG.';
        this.selectedPhotoFile = null;
        this.photoPreviewUrl = null;
        return;
      }

      if (file.size > maxSize) {
        this.photoError = 'Attēls ir pārāk liels. Maksimālais izmērs – 10MB.';
        this.selectedPhotoFile = null;
        this.photoPreviewUrl = null;
        return;
      }

      // ja ir ok tad radam attelu
      this.photoError = null;
      this.selectedPhotoFile = file;

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
      this.step = 4;
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

  submitRegistration(): void {
    if (!this.registerForm.valid || this.selectedGenres.length < 3) return;

    const formData = new FormData();
    formData.append('username', this.registerForm.value.username);
    formData.append('email', this.registerForm.value.email);
    formData.append('password', this.registerForm.value.password);

    if (this.selectedPhotoFile) {
      formData.append('photo', this.selectedPhotoFile);
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
        this.http.post('http://127.0.0.1:8000/api/register', formData, { withCredentials: true })
          .subscribe({
            next: () => {
              this.loading = false;
              alert('Veiksmīga reģistrācija!');
            },
            error: (err) => {
              this.loading = false;
              this.error = 'Neizdevās reģistrācija. Mēģini vēlreiz.';
              console.error(err);
            }
          });
      });
  }

}
