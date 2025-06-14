// src/app/services/player.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';


@Injectable({ providedIn: 'root' })
export class PlayerService {
  private currentTrackSubject = new BehaviorSubject<any>(null);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  private currentTimeSubject = new BehaviorSubject<number>(0);

  private currentSource: { type: 'playlist' | 'album' | 'search' | 'manual', name: string } | null = null;

  
  currentTrack$ = this.currentTrackSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();
  currentTime$ = this.currentTimeSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Atskaņo izveleto dziesmu
  // setTrack(track: any, autoPlay = false) {
  //   console.log('Setting track:', track);
    
  //   const isSameTrack = this.currentTrackSubject.value?.id === track.id;
  
  //   if (isSameTrack) {
  //     console.log('Same track, toggling playback');
  //     if (this.isPlayingSubject.value) {
  //       this.isPlayingSubject.next(false);
  //     } else {
  //       this.isPlayingSubject.next(true);
  //     }
  //     return;
  //   }

  //   // Ja track satur tikai ID, tad iegūstam pilnu informāciju
  //   if (track.id) {
  //     console.log('Always fetching full track by ID:', track.id);
  //     this.http.get<any>(`/api/tracks/${track.id}`, { withCredentials: true }).subscribe({
  //       next: (fullTrack) => {
          
  //         this.updateTrackStatus(fullTrack, autoPlay);
  //       }
  //     });
  //     return;
  //   }
    
  // }

  setTrack(track: any, autoPlay = false) {
    const trackId = track?.id;
    if (!trackId) {
      console.error('Nedarīgs track ID:', track);
      return;
    }
    
    this.http.get<any>(`/api/tracks/${trackId}`, { withCredentials: true }).subscribe({
      next: (fullTrack) => {
        console.log('Full track loaded:', fullTrack);
  
        if (fullTrack.active_version) {
          const version = fullTrack.active_version;
          fullTrack.audio_file = version.audio_file;
          fullTrack.lyrics = version.lyrics;
          fullTrack.lyrics_visible = version.lyrics_visible;
          fullTrack.bpm = version.bpm;
          fullTrack.key = version.key;
          fullTrack.stems = (version.stems || []).map((s: any) => ({
            type: s.stem_type,
            url: s.audio_file
          }));
        }
  
        if (!fullTrack.audio_file) {
          console.error('Full track has no audio_file:', fullTrack);
          return;
        }
  
        if (fullTrack.artist?.username) {
          fullTrack.artist_name = fullTrack.artist.username;
        }
  
        this.updateTrackStatus(fullTrack, autoPlay);
      },
      error: err => {
        console.error('Neizdevās ielādēt pilnu track:', err);
      }
    });
  }
  

  private updateTrackStatus(track: any, autoPlay: boolean) {
    console.log('Updating track status:', { track, autoPlay });
    
    // artista datu iegusana, lai nodrošinātu konsekvenci
    if (track.artist?.username) {
      track.artist_name = track.artist.username;
    }
    
    // atjaunojam statusu serveri
    const source = this.getSource();
    this.http.post('/api/playback/status', {
      track_id: track.id,
      current_time: 0,
      is_playing: autoPlay,
      play_mode: 'off',
      source_type: source?.type || null,
      source_name: source?.name || null
    }, { withCredentials: true }).subscribe({
      next: () => {
        console.log('Status updated successfully');
        this.currentSource = source;
        this.currentTrackSubject.next(track);
        this.setCurrentTime(0);
        this.isPlayingSubject.next(autoPlay);
      },
      error: err => {
        console.error('Neizdevās saglabāt statusu:', err);
      }
    });
  }
  

  togglePlayback() {
    const current = this.isPlayingSubject.value;
    this.isPlayingSubject.next(!current);
  }

  getCurrentTrack() {
    return this.currentTrackSubject.value;
  }

  getIsPlaying(): boolean {
    return this.isPlayingSubject.value;
  }

  getCurrentTime(): number {
    return this.currentTimeSubject.value;
  }

  setCurrentTime(seconds: number) {
    this.currentTimeSubject.next(seconds);
  }

  // atskanosanas rinda
  queue: any[] = [];
  queueIndex: number = 0;

  // setQueue(tracks: any[], startIndex = 0, skipInitialTrack = false) {
  //   this.queue = tracks.map(track => {
  //     this.http.get<any>(`/api/tracks/${track.id}`, { withCredentials: true }).subscribe({
  //       next: (fullTrack) => {
  //         if (fullTrack.artist?.username) {
  //           fullTrack.artist_name = fullTrack.artist.username;
  //         }
  
  //         const index = this.queue.findIndex(t => t.id === track.id);
  //         if (index !== -1) {
  //           this.queue[index] = fullTrack;
  //           if (this.currentTrackSubject.value?.id === track.id) {
  //             this.currentTrackSubject.next(fullTrack);
  //           }
  //         }
  //       },
  //       error: err => console.error('Failed to load full track data:', err)
  //     });
  
  //     return track;
  //   });
  
  //   this.queueIndex = startIndex;
  
  //   if (!skipInitialTrack) {
  //     this.setTrack(tracks[startIndex], this.isPlayingSubject.value);
  //   }
  // }

  setQueue(tracks: any[], startIndex = 0, skipInitialTrack = false) {
    this.queue = tracks;
    this.queueIndex = startIndex;
  
    if (!skipInitialTrack) {
      this.setTrack(tracks[startIndex], this.getIsPlaying());
    }
  }
  
  

  playNextInQueue() {
    if (this.queueIndex + 1 < this.queue.length) {
      this.queueIndex++;
      this.setTrack(this.queue[this.queueIndex], true);
    }
  }

  // Iegūst iepriekšējo dziesmu rindā
  getPreviousTrack(): any | null {
    if (this.queue.length > 0 && this.queueIndex > 0) {
      this.queueIndex--;
      return this.queue[this.queueIndex];
    }
    return null;
  }

  getNextTrack(): any | null {
    if (this.queue.length > 0 && this.queueIndex < this.queue.length - 1) {
      this.queueIndex++;
      return this.queue[this.queueIndex];
    }
    return null;
  }

  private sourceSubject = new BehaviorSubject<{ type: string, name: string } | null>(null);
  source$ = this.sourceSubject.asObservable();

  setSource(type: 'playlist' | 'album' | 'search' | 'manual', name: string) {
    this.currentSource = { type, name };
    this.sourceSubject.next(this.currentSource);
  }
  
  getSource() {
    return this.currentSource;
  }

  setIsPlaying(isPlaying: boolean) {
    this.isPlayingSubject.next(isPlaying);
  }
}
