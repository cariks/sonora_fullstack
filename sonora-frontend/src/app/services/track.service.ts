import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TrackService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getAllTracks() {
    return this.http.get<any[]>(`${this.apiUrl}/tracks`, { withCredentials: true });
  }

  getLikedPlaylist() {
    return this.http.get<any>(`${this.apiUrl}/playlists/liked`, { withCredentials: true });
  }

  getPopularPlaylist() {
    return this.http.get<any>('/api/playlists/popular', { withCredentials: true });
  }

  getFreshPlaylist() {
    return this.http.get<any>('/api/playlists/fresh', { withCredentials: true });
  }

  getGenrePlaylist(genreId: number) {
    return this.http.get<any>(`/api/playlists/genre/${genreId}`, { withCredentials: true });
  }
}
