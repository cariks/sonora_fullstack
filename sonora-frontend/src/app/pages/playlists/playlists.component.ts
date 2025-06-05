import {Component, OnInit} from '@angular/core';
import { PlaylistService } from '../../services/playlist.service';
import { PlaylistOptionsModalComponent } from '../../shared/components/playlist-options-modal/playlist-options-modal.component';

@Component({
  selector: 'app-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss']
})
export class PlaylistsComponent implements OnInit {
  playlists: any[] = [];

  isPlaylistModalOpen: boolean = false;

  contextMenuPosition = { x: 0, y: 0 };
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

  refreshPlaylists(): void {
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


  // Modal lai rediget un dzest
  showOptionsModal = false;
  selectedPlaylistId: number | null = null;
  selectedPlaylistType: string | null = null;


  modalPosition = { top: '0px', left: '0px' };

  onRightClickPlaylist(event: MouseEvent, playlist: any) {
    event.preventDefault();

    this.selectedPlaylistId = playlist.id;
    this.selectedPlaylistType = playlist.type;
    this.showOptionsModal = true;

    this.modalPosition = {
      top: `${event.clientY}px`,
      left: `${event.clientX}px`
    };
  }

  closeOptionsModal = () => {
    this.showOptionsModal = false;
    this.selectedPlaylistId = null;
  };

  onPlaylistEdited() {
    //this.loadPlaylists();
    this.closeOptionsModal();
  }

  onDeletePlaylist(): void {
    console.log('Dzest', this.selectedPlaylistId);

  }

  handleDeletedPlaylist() {
    this.closeOptionsModal();
    this.ngOnInit();
  }

}
