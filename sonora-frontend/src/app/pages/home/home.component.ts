import { Component, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { TrackService } from '../../services/track.service';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  tracks: any[] = [];
  @ViewChildren('audioRef') audioElements!: QueryList<ElementRef>;
  currentTrack: any = null;

  constructor(
    private trackService: TrackService,
    private playerService: PlayerService
  ) {}

  ngOnInit() {
    this.trackService.getAllTracks().subscribe({
      next: (data) => this.tracks = data,
      error: (err) => console.error('Failed to load tracks', err)
    });
  }

  togglePlay(track: any) {
    if (this.playerService.getCurrentTrack()?.id === track.id) {
      // if the same song then pause
      this.playerService.togglePlayback();
    } else {
      // if new song start playing
      this.playerService.setTrack(track, true);
    }
  }

  isPlaying(track: any): boolean {
    return this.playerService.getCurrentTrack()?.id === track.id && this.playerService.getIsPlaying();

  }

}
