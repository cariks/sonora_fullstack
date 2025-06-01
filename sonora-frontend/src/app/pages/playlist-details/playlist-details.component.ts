import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TrackService } from '../../services/track.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-playlist-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playlist-details.component.html',
  styleUrl: './playlist-details.component.scss'
})
export class PlaylistDetailsComponent implements OnInit {
  playlistName: string = '';
  tracks: any[] = [];

  constructor(private route: ActivatedRoute, private trackService: TrackService) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (!slug) return;

    if (slug === 'liked') {
      this.trackService.getLikedPlaylist().subscribe({
        next: (res) => {
          this.playlistName = res.playlist_name;
          this.tracks = res.tracks;
        },
        error: (err) => console.error('Error loading liked playlist', err)
      });
    } else if (slug === 'popular') {
      this.trackService.getPopularPlaylist().subscribe({
        next: (res) => {
          this.playlistName = res.playlist_name;
          this.tracks = res.tracks;
        },
        error: (err) => console.error('Error loading popular playlist', err)
      });
    } else if (slug === 'fresh') {
      this.trackService.getFreshPlaylist().subscribe({
        next: (res) => {
          this.playlistName = res.playlist_name;
          this.tracks = res.tracks;
        },
        error: (err) => console.error('Error loading fresh playlist', err)
      });
    } else if (slug.startsWith('genre-')) {
      const genreId = slug.split('genre-')[1];
      this.trackService.getGenrePlaylist(+genreId).subscribe({
        next: (res) => {
          this.playlistName = res.playlist_name;
          this.tracks = res.tracks;
        },
        error: (err) => console.error('Error loading genre playlist', err)
      });
    } else {
      // fallback или custom playlist по id, если надо
    }
  }

}
