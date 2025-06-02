import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TrackService } from '../../services/track.service';
import { TrackLikesService } from '../../services/track-likes.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlaybackQueueService } from '../../services/playback-queue.service';
import { PlayerService } from '../../services/player.service';
import { PlaylistUpdateService } from '../../services/playlist-update.service';

@Component({
  selector: 'app-playlist-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playlist-details.component.html',
  styleUrl: './playlist-details.component.scss'
})
export class PlaylistDetailsComponent implements OnInit, OnDestroy {
  playlistName: string = '';
  playlistDesc: string = '';
  tracks: any[] = [];
  idOrType: string | null = null;
  playlistType: string = '';
  gradient: string = '';
  iconType: string = '';

  playlistCoverImage: string | null = null;

  private likedUpdateSub: Subscription | null = null;

  private playlistUpdateSub!: Subscription;


  constructor(
    private route: ActivatedRoute,
    private trackService: TrackService,
    private trackLikesService: TrackLikesService,
    private playbackQueueService: PlaybackQueueService,
    private playerService: PlayerService,
    private playlistUpdateService: PlaylistUpdateService,

  ) {}

  ngOnInit(): void {
    this.route.url.subscribe(segments => {
      const type = segments[1]?.path; // liked | manual | genre
      const id = segments[2]?.path || null;

      this.playlistType = type;
      this.idOrType = id;

      this.loadPlaylist();

      if (type === 'liked') {
        this.likedUpdateSub = this.trackLikesService.getLikedPlaylistUpdateObservable().subscribe(() => {
          this.refreshTracks();
        });
      }
    });

    this.playlistUpdateSub = this.playlistUpdateService.updates$.subscribe(() => {
      this.refreshTracks();
    });
  }


  ngOnDestroy(): void {
    this.likedUpdateSub?.unsubscribe();
    this.playlistUpdateSub?.unsubscribe();
  }

  loadPlaylist(): void {
    if (!this.playlistType) return;

    const identifier = this.playlistType === 'liked' ? 'liked' : this.idOrType;

    this.trackService.getTracksByPlaylist(identifier!).subscribe({
      next: (res) => {
        this.playlistName = res.playlist_name;
        this.playlistDesc = res.playlist_description;
        this.tracks = res.tracks;
        this.iconType = res.type || this.playlistType;
        this.playlistCoverImage = res.cover_image || null;

        if (res.type === 'genre' && res.gradient) {
          this.gradient = res.gradient;
        }
      },
      error: (err) => {
        console.error('Error loading playlist', err);
      }
    });
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
