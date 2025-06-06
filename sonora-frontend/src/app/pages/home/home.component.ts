import { Component, OnInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { TrackService } from '../../services/track.service';
import { PlayerService } from '../../services/player.service';
import {PlaylistService} from "../../services/playlist.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  tracks: any[] = [];
  @ViewChildren('audioRef') audioElements!: QueryList<ElementRef>;
  currentTrack: any = null;

  playlists: any[] = [];

  constructor(
    private trackService: TrackService,
    private playerService: PlayerService,
    private playlistService: PlaylistService,
  ) {}

  likedPlaylist: any = null;

  ngOnInit() {
    this.trackService.getAllTracks().subscribe({
      next: (data) => this.tracks = data,
      error: (err) => console.error('Failed to load tracks', err)
    });

    this.trackService.getLikedPlaylist().subscribe({
      next: (data) => this.likedPlaylist = data,
      error: (err) => console.error('Failed to load liked playlist', err)
    });

    // Ieladet playlistus
    this.playlistService.getUserPlaylists().subscribe({
      next: (data) => {
        this.playlists = data.map(p => {
          if (p.type === 'genre') {
            const gradients = [
              'linear-gradient(to bottom right, #6A178B, #9A58F6, #ffffff)',
              'linear-gradient(to bottom right, #D41D91, #FF73E5, #ffffff)',
              'linear-gradient(to bottom right, #205EC8, #5292FF, #ffffff)',
              'linear-gradient(to bottom right, #1782B8, #38DBFF, #ffffff)',
              'linear-gradient(to bottom right, #C41B20, #F8676B, #ffffff)',
              'linear-gradient(to bottom right, #3A3292, #958BFE, #ffffff)',
              'linear-gradient(to bottom right, #16AD4A, #28EB58, #ffffff)',
            ];
            p.gradient = gradients[Math.floor(Math.random() * gradients.length)];
          }
          return p;
        });
      },
      error: (err) => console.error('Failed to load playlists', err)
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
