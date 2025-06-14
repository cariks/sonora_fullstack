// src/app/services/equalizer.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EqualizerPreset {
  eq_preset_id: number;
  name: string;
  icon: string;
  eq_setting: number[];
  position: number;
}

export interface UserAudioSettings {
  eq_enabled: boolean;
  eq_settings: number[];
  selected_preset_id: number | null;
  stereo_expansion_enabled: boolean;
  stereo_expansion_level: number;
}

@Injectable({
  providedIn: 'root'
})
export class EqualizerService {
  private readonly API_URL = '/api/equalizer';

  constructor(private http: HttpClient) {}

  getPresets(): Observable<EqualizerPreset[]> {
    return this.http.get<EqualizerPreset[]>(`${this.API_URL}/presets`, { withCredentials: true });
  }

  createPreset(data: {
    name: string;
    icon: string;
    eq_setting: number[];
    position?: number;
  }): Observable<EqualizerPreset> {
    return this.http.post<EqualizerPreset>(`${this.API_URL}/presets`, data, { withCredentials: true });
  }

  updatePreset(id: number, data: { name?: string; icon?: string; eq_setting?: number[] }): Observable<any> {
    return this.http.put(`${this.API_URL}/presets/${id}`, data, { withCredentials: true });
  }
  

  deletePreset(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/presets/${id}`, { withCredentials: true });
  }

  getUserSettings(): Observable<UserAudioSettings> {
    return this.http.get<UserAudioSettings>(`${this.API_URL}/settings`, { withCredentials: true });
  }

  updateUserSettings(data: Partial<UserAudioSettings>): Observable<any> {
    return this.http.put(`${this.API_URL}/settings`, data, { withCredentials: true });
  }
}
