// src/app/services/player.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private currentTrackSubject = new BehaviorSubject<any>(null);
  private isPlayingSubject = new BehaviorSubject<boolean>(false);
  private currentTimeSubject = new BehaviorSubject<number>(0);

  currentTrack$ = this.currentTrackSubject.asObservable();
  isPlaying$ = this.isPlayingSubject.asObservable();
  currentTime$ = this.currentTimeSubject.asObservable();

  // Atskaņo izveleto dziesmu
  setTrack(track: any, autoPlay = false) {
    this.currentTrackSubject.next(track);
    this.setCurrentTime(0); // atiestatam laiku
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


  getCurrentTime(): number {
    return this.currentTimeSubject.value;
  }

  setCurrentTime(seconds: number) {
    this.currentTimeSubject.next(seconds);
  }

  // atskanosanas rinda
  queue: any[] = [];
  queueIndex: number = 0;

  setQueue(tracks: any[], startIndex = 0) {
    this.queue = tracks;
    this.queueIndex = startIndex;
    this.setTrack(tracks[startIndex], true);
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
}
