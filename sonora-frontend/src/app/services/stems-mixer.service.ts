import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StemsMixerService {
  private apiUrl = '/api/user/stems-mixer';

  constructor(private http: HttpClient) {}

  getMixerSettings() {
    return this.http.get<any>(this.apiUrl, { withCredentials: true });
  }

  updateMixerSettings(data: Partial<{
    is_stems_mode: boolean;
    bass_level: number;
    drums_level: number;
    melody_level: number;
    vocals_level: number;
  }>) {
    return this.http.patch(this.apiUrl, data, { withCredentials: true });
  }
}
