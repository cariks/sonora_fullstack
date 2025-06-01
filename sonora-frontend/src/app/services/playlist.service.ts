import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  private playlistsSubject = new BehaviorSubject<any[]>([]);
  playlists$ = this.playlistsSubject.asObservable();
  constructor(private http: HttpClient) {}

  getUserPlaylists() {
    return this.http.get<any[]>('/api/playlists', { withCredentials: true });
  }

  loadPlaylists() {
    this.http.get<any[]>('/api/playlists', { withCredentials: true }).subscribe({
      next: (playlists) => this.playlistsSubject.next(playlists),
      error: (err) => console.error('Failed to load playlists', err)
    });
  }

  get playlists(): any[] {
    return this.playlistsSubject.value;
  }
}
