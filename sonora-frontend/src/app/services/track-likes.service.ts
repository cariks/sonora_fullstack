import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TrackLikesService {
  constructor(private http: HttpClient) {}

  getUserTrackLike(trackId: number) {
    return this.http.get<any>(`/api/tracks/${trackId}/like-status`, { withCredentials: true });
  }

  setTrackLike(trackId: number, status: 'like' | 'dislike' | null) {
    if (status === 'like') {
      return this.http.post(`/api/tracks/${trackId}/like`, {}, { withCredentials: true });
    } else if (status === 'dislike') {
      return this.http.post(`/api/tracks/${trackId}/dislike`, {}, { withCredentials: true });
    } else {
      return this.http.delete(`/api/tracks/${trackId}/like`, { withCredentials: true });
    }
  }
}
