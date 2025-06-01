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

  playlists: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private playlistService: PlaylistService,
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const username = params['username'];
      this.http.get(`http://localhost:8000/api/users/${username}`).subscribe({
        next: (res) => this.profileUser = res
      });
    });

    this.loadPlaylists();
  }

  loadUser() {
    this.http.get(`http://localhost:8000/api/users/${this.username}`)
      .subscribe({
        next: (res) => this.profileUser = res,
        error: (err) => console.error('User not found', err)
      });
  }


  loadPlaylists() {
    this.playlistService.getUserPlaylists().subscribe({
      next: (res) => this.playlists = res,
      error: (err) => console.error('Error loading playlists', err)
    });
  }
}
