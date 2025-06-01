import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlayerService } from './player.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PlaybackQueueService {
  private apiUrl = '/api/playback';

  constructor(private http: HttpClient, private playerService: PlayerService) {}

  // ieladejam dziesmas
  // async playPlaylistFromIdentifier(identifier: string, startIndex = 0) {
  //   const response: any = await this.http
  //     .get(`/api/playlists/${identifier}`, { withCredentials: true })
  //     .toPromise();
  //
  //   const tracks = response.tracks || [];
  //   const trackIds = tracks.map((t: any) => t.id);
  //
  //   await this.updateQueue(trackIds).toPromise();
  //   this.playerService.setQueue(tracks, startIndex);
  // }

  updateQueue(trackIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/queue`, { track_ids: trackIds }, { withCredentials: true });
  }

  loadQueue(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/queue`, { withCredentials: true });
  }

  clearQueue(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/queue`, { withCredentials: true });
  }

  setQueueFromTracks(tracks: any[], startIndex = 0) {
    const trackIds = tracks.map(t => t.id);
    this.updateQueue(trackIds).subscribe({
      next: () => {
        this.playerService.setQueue(tracks, startIndex);
      },
      error: err => {
        console.error('Kļūda - nevar atjaunot atskaņošanas rindu', err);
      }
    });
  }
}
