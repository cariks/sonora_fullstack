import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TrackPlaylistService {
  constructor(private http: HttpClient) {}

  getPlaylistsWithTrack(trackId: number) {
    return this.http.get<number[]>(`/api/playlist-tracks/track/${trackId}`, { withCredentials: true });
  }

  addTrackToPlaylist(playlistId: number, trackId: number) {
    return this.http.post('/api/playlist-tracks/add', { playlist_id: playlistId, track_id: trackId }, { withCredentials: true });
  }

  removeTrackFromPlaylist(playlistId: number, trackId: number) {
    return this.http.post('/api/playlist-tracks/remove', { playlist_id: playlistId, track_id: trackId }, { withCredentials: true });
  }

  likeTrack(trackId: number) {
    return this.http.post(`/api/tracks/${trackId}/like`, {}, { withCredentials: true });
  }
}
