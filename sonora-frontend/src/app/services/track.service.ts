import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TrackService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getAllTracks() {
    return this.http.get<any[]>(`${this.apiUrl}/tracks`, { withCredentials: true });
  }
}
