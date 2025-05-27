import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    // Ja lietotājs jau ir saglabāts - let go
    const user = this.auth.getCurrentUser();
    if (user) {
      return of(true);
    }

    // Pretējā gadījumā - pieprasijums
    return this.auth.fetchUser().pipe(
      map((user) => !!user || this.router.createUrlTree(['/auth-page'])),
      catchError(() => of(this.router.createUrlTree(['/auth-page'])))
    );
  }

}
