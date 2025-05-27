import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable, switchMap} from 'rxjs';
import { of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = '';
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  getCsrfToken() {
    return this.http.get(`${this.api}/sanctum/csrf-cookie`, { withCredentials: true });
  }

  login(data: { email: string; password: string }) {
    return this.http.post(`${this.api}/api/login`, data, { withCredentials: true }).pipe(
      switchMap(() => this.fetchUser()) // gaidam
    );
  }



  logout() {
    return this.http.post(`${this.api}/api/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.currentUserSubject.next(null))
    );
  }

  fetchUser(): Observable<any> {
    return this.http.get(`${this.api}/api/user`, { withCredentials: true }).pipe(
      tap(user => this.currentUserSubject.next(user)),
      catchError(() => {
        this.currentUserSubject.next(null);
        return of(null); // atgriezt observable
      })
    );
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }



  // ielādē vienu reizi, piemēram uz startu
  initUser() {
    this.fetchUser();
  }
}
