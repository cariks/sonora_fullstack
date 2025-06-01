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

  getTracksByPlaylist(identifier: string) {
    return this.http.get<any>(`/api/playlists/${identifier}/tracks`, {
      withCredentials: true,
    });
  }

  removeTrackFromPlaylist(playlistId: string, trackId: number) {
    return this.http.delete(`/api/playlists/${playlistId}/tracks/${trackId}`, { withCredentials: true });
  }

  addTrackToPlaylist(playlistId: string, trackId: number) {
    return this.http.post(`/api/playlists/${playlistId}/tracks`, { track_id: trackId }, { withCredentials: true });
  }

}
