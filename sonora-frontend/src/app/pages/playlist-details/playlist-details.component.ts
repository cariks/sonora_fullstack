import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TrackService } from '../../services/track.service';
import { TrackLikesService } from '../../services/track-likes.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlaybackQueueService } from '../../services/playback-queue.service';
import { PlayerService } from '../../services/player.service';

@Component({
  selector: 'app-playlist-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playlist-details.component.html',
  styleUrl: './playlist-details.component.scss'
})
export class PlaylistDetailsComponent implements OnInit, OnDestroy {
  playlistName: string = '';
  tracks: any[] = [];
  idOrType: string | null = null;
  playlistType: string = '';
  gradient: string = '';
  iconType: string = '';

  private likedUpdateSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private trackService: TrackService,
    private trackLikesService: TrackLikesService,
    private playbackQueueService: PlaybackQueueService,
    private playerService: PlayerService,
  ) {}

  ngOnInit(): void {
    this.idOrType = this.route.snapshot.paramMap.get('slug');
    this.loadPlaylist();

    // ja ir liked tad atjaunojam
    if (this.idOrType === 'liked') {
      this.likedUpdateSub = this.trackLikesService.getLikedPlaylistUpdateObservable().subscribe(() => {
        this.refreshTracks();
      });
    }
  }

  ngOnDestroy(): void {
    this.likedUpdateSub?.unsubscribe();
  }

  loadPlaylist(): void {
    if (this.idOrType) {
      this.trackService.getTracksByPlaylist(this.idOrType).subscribe({
        next: (res) => {
          this.playlistName = res.playlist_name;
          this.tracks = res.tracks;
          this.playlistType = res.type || this.idOrType;
          this.iconType = res.type || this.idOrType;

          if (res.type === 'genre' && res.gradient) {
            this.gradient = res.gradient;
          }
        },
        error: (err) => {
          console.error('Error loading playlist', err);
        },
      });


    }
  }

  removeFromPlaylist(trackId: number): void {
    if (!this.idOrType) return;

    // ja ir no liked, tad vispirms nonemam like
    if (this.idOrType === 'liked') {
      this.trackLikesService.setTrackLike(trackId, null).subscribe({
        next: () => {
          this.trackLikesService.removeFromLikedPlaylist(trackId).subscribe({
            next: () => this.refreshTracks(),
            error: (err) => console.error('Kļūda - noņemt no liked playlist', err)
          });
        },
        error: (err) => console.error('Kļūda - noņemt like', err)
      });
    } else {
      // parastais plejlists
      this.trackService.removeTrackFromPlaylist(this.idOrType, trackId).subscribe({
        next: () => this.refreshTracks(),
        error: (err) => console.error('Kļūda - dzēst', err)
      });
    }
  }

  refreshTracks(): void {
    this.loadPlaylist();
  }


  // Atskanosanas rinda


  playFromIndex(index: number): void {
    const sorted = this.sortedTracks;
    this.playbackQueueService.setQueueFromTracks(sorted, index);
  }

  sortDirection: 'asc' | 'desc' = 'asc'; // sakotneji augosa seciba

  get sortedTracks(): any[] {
    return [...this.tracks].sort((a, b) =>
      this.sortDirection === 'asc' ? a.id - b.id : b.id - a.id
    );
  }

  toggleSortDirection(): void {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  }

  playEntirePlaylistSorted() {
    const sorted = this.sortedTracks;
    this.playbackQueueService.setQueueFromTracks(sorted, 0);
  }
}
