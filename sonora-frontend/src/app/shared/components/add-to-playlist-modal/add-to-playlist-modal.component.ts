import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Renderer2
} from '@angular/core';
import { PlaylistService } from '../../../services/playlist.service';
import { TrackPlaylistService } from '../../../services/track-playlist.service';
import { NgForOf, NgIf } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlaylistUpdateService } from '../../../services/playlist-update.service'; // путь по проекту

@Component({
  selector: 'app-add-to-playlist-modal',
  standalone: true,
  imports: [NgIf, NgForOf],
  templateUrl: './add-to-playlist-modal.component.html',
  styleUrl: './add-to-playlist-modal.component.scss'
})
export class AddToPlaylistModalComponent implements OnInit, OnDestroy {
  @Input() trackId!: number;
  @Input() close!: () => void;
  @Output() updated = new EventEmitter<void>();

  @ViewChild('modalWrapper') modalWrapper!: ElementRef;

  playlists: any[] = [];
  selected: Set<number> = new Set();
  loading = true;
  saving = false;

  private globalClickListener!: () => void;

  constructor(
    private playlistService: PlaylistService,
    private trackPlaylistService: TrackPlaylistService,
    private playlistUpdateService: PlaylistUpdateService,
    private renderer: Renderer2
  ) {
  }

  ngOnInit(): void {
    this.loadData();

    this.globalClickListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
      if (this.modalWrapper && !this.modalWrapper.nativeElement.contains(event.target)) {
        this.close();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.globalClickListener) {
      this.globalClickListener();
    }
  }

  loadData() {
    this.loading = true;
    this.playlistService.getUserPlaylists().subscribe({
      next: (playlists) => {
        this.trackPlaylistService.getPlaylistsWithTrack(this.trackId).subscribe({
          next: (ids) => {
            this.selected = new Set(ids);
            this.playlists = playlists
              .filter(p => p.type === 'liked' || p.type === 'manual')
              .map(p => ({
                ...p,
                containsTrack: ids.includes(p.id)
              }));
            this.loading = false;
          },
          error: () => (this.loading = false)
        });
      },
      error: () => (this.loading = false)
    });
  }

  toggle(playlistId: number) {
    if (this.selected.has(playlistId)) {
      this.selected.delete(playlistId);
    } else {
      this.selected.add(playlistId);
    }
  }

  isSelected(playlistId: number): boolean {
    return this.selected.has(playlistId);
  }

  confirm() {
    this.saving = true;
    const updates = [];
    let likedChanged = false;

    for (let playlist of this.playlists) {
      const id = playlist.id;
      const wasSelected = this.isSelected(id);
      const inDb = playlist.containsTrack;

      if (wasSelected && !inDb) {
        updates.push(this.trackPlaylistService.addTrackToPlaylist(id, this.trackId));
        if (playlist.type === 'liked') {
          updates.push(this.trackPlaylistService.likeTrack(this.trackId));
          likedChanged = true;
        }
      } else if (!wasSelected && inDb) {
        updates.push(this.trackPlaylistService.removeTrackFromPlaylist(id, this.trackId));
        if (playlist.type === 'liked') {
          likedChanged = true;
        }
      }
    }

    Promise.all(updates.map(req => req.toPromise()))
      .then(() => {
        this.playlistService.loadPlaylists();
        this.playlistUpdateService.emitUpdate();
        if (likedChanged) {
          this.playlistUpdateService.emitLikeStatusChange();
        }
        this.close();
      })
      .finally(() => (this.saving = false));
  }
}
