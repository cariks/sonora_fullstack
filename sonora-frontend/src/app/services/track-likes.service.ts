import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TrackLikesService {

  private likedPlaylistUpdated = new Subject<void>();


  notifyLikedPlaylistUpdated() {
    this.likedPlaylistUpdated.next();
  }

  getLikedPlaylistUpdateObservable(): Observable<void> {
    return this.likedPlaylistUpdated.asObservable();
  }

  constructor(private http: HttpClient) {}

  getUserTrackLike(trackId: number) {
    return this.http.get<any>(`/api/tracks/${trackId}/like-status`, { withCredentials: true });
  }

  setTrackLike(trackId: number, status: 'like' | 'dislike' | null) {
    if (status === 'like') {
      return this.http.post(`/api/tracks/${trackId}/like`, {}, { withCredentials: true }).pipe(
        tap(() => this.notifyLikedPlaylistUpdated())
      );
    } else if (status === 'dislike') {
      return this.http.post(`/api/tracks/${trackId}/dislike`, {}, { withCredentials: true }).pipe(
        tap(() => this.notifyLikedPlaylistUpdated())
      );
    } else {
      return this.http.delete(`/api/tracks/${trackId}/like`, { withCredentials: true }).pipe(
        tap(() => this.notifyLikedPlaylistUpdated())
      );
    }
  }


  addToLikedPlaylist(trackId: number) {
    return this.http.post('/api/playlist-tracks/add', {
      track_id: trackId,
      playlist_type: 'liked',
    }, { withCredentials: true });
  }

  removeFromLikedPlaylist(trackId: number) {
    return this.http.post('/api/playlist-tracks/remove', {
      track_id: trackId,
      playlist_type: 'liked',
    }, { withCredentials: true });
  }
}
