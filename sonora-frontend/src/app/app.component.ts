import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { PlaybackQueueService } from './services/playback-queue.service';
import { PlayerService } from './services/player.service';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'sonora-frontend';
  isAppReady = false;

  isPlaylistModalOpen = false;


  constructor(
    private auth: AuthService,
    private router: Router,
    private playbackQueueService: PlaybackQueueService,
    private playerService: PlayerService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    // navigācija
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isAppReady = true;
    });
  }
}
