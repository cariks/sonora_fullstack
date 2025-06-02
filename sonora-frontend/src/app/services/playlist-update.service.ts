import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PlaylistUpdateService {
  private updateSubject = new Subject<void>();
  private likeStatusSubject = new Subject<void>();

  get updates$() {
    return this.updateSubject.asObservable();
  }

  emitUpdate() {
    this.updateSubject.next();
  }

  get likeStatusChanged$() {
    return this.likeStatusSubject.asObservable();
  }

  emitLikeStatusChange() {
    this.likeStatusSubject.next();
  }
}
