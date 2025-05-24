// src/app/services/player.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private currentTrackSubject = new BehaviorSubject<any>(null);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  private currentTimeSubject = new BehaviorSubject<number>(0); // NEW

  currentTrack$ = this.currentTrackSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();
  currentTime$ = this.currentTimeSubject.asObservable(); // NEW

  setTrack(track: any, autoPlay = false) {
    this.currentTrackSubject.next(track);
    this.setCurrentTime(0); // reset time when track changes
    this.isPlayingSubject.next(autoPlay);
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

  //

  getCurrentTime(): number {
    return this.currentTimeSubject.value;
  }

  setCurrentTime(seconds: number) {
    this.currentTimeSubject.next(seconds);
  }
}
