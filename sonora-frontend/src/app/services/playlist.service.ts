import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  private playlistsSubject = new BehaviorSubject<any[]>([]);
  playlists$ = this.playlistsSubject.asObservable();

  constructor(private http: HttpClient) {
  }

  getUserPlaylists() {
    return this.http.get<any[]>('/api/playlists', {withCredentials: true});
  }

  loadPlaylists() {
    this.http.get<any[]>('/api/playlists', {withCredentials: true}).subscribe({
      next: (playlists) => this.playlistsSubject.next(playlists),
      error: (err) => console.error('Failed to load playlists', err)
    });
  }

  get playlists(): any[] {
    return this.playlistsSubject.value;
  }

  createPlaylist(formData: FormData) {
    return this.http.post('/api/playlists/create', formData, {withCredentials: true});
  }

  getPlaylistsForTrack(trackId: number) {
    return this.http.get<any[]>(`/api/playlists/for-track/${trackId}`, {
      withCredentials: true,
    });
  }

  toggleTrackInPlaylist(trackId: number, playlistId: number) {
    return this.http.post(`/api/playlists/toggle-track`, {
      track_id: trackId,
      playlist_id: playlistId
    }, {
      withCredentials: true
    });
  }

  deletePlaylist(id: number) {
    return this.http.delete(`/api/playlists/${id}`);
  }

  onDeletePlaylist(): void {
    this.loadPlaylists();
    alert('Plejlists tika izdzēsts.');
  }
}
