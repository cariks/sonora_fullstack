import {Component, OnInit} from '@angular/core';
import { PlaylistService } from '../../services/playlist.service';

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss']
})
export class PlaylistsComponent implements OnInit {
  playlists: any[] = [];

  isPlaylistModalOpen: boolean = false;

  constructor(private playlistService: PlaylistService) {}

  ngOnInit(): void {
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
      error: (err) => console.error('Kļūda ielādējot plejlistus', err)
    });
  }
}
