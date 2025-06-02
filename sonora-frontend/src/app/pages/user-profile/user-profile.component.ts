import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PlaylistService } from 'src/app/services/playlist.service';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {
  profileUser: any;
  username: string = '';

  publicTracks: any[] = [];
  playlists: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private playlistService: PlaylistService,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const username = params['username'];
      this.username = username;

      this.http.get(`http://localhost:8000/api/users/${username}`).subscribe({
        next: (res) => {
          this.profileUser = res;
          this.loadPlaylists(); // tikai pec user
          this.loadPublicTracks();
        },
        error: (err) => console.error('User not found', err)
      });
    });
  }


  loadUser() {
    this.http.get(`http://localhost:8000/api/users/${this.username}`)
      .subscribe({
        next: (res) => this.profileUser = res,
        error: (err) => console.error('User not found', err)
      });
  }


  loadPlaylists() {
    if (!this.username) return;

    this.http.get(`http://localhost:8000/api/users/${this.username}/public-playlists`).subscribe({
      next: (res: any) => {
        this.playlists = res.filter((p: any) => p.type === 'manual' && p.is_public);
      },
      error: (err) => console.error('Error loading playlists', err)
    });
  }

  loadPublicTracks() {
    if (!this.username) return;

    this.http.get(`http://localhost:8000/api/users/${this.username}/public-tracks`).subscribe({
      next: (res: any) => {
        this.publicTracks = res;
      },
      error: (err) => console.error('Error loading public tracks', err)
    });
  }
}
