// Importē nepieciešamos Angular elementus un servisus
import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';
import { StemsMixerService } from '../../services/stems-mixer.service';
import { ViewChildren, QueryList } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { TrackLikesService } from '../../services/track-likes.service';
import { AuthService } from '../../services/auth.service';
import { PlaylistUpdateService } from '../../services/playlist-update.service';

// Komponents, kas atbild par mūzikas atskaņošanu un playera interfeisu
@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @ViewChild('audioRef') audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChildren('stemAudioRef') stemAudioElements!: QueryList<ElementRef<HTMLAudioElement>>;
  @Output() widthChanged = new EventEmitter<number>();

  currentTrack: any = null;
  isPlaying = false;
  isStemsMode = false;
  stems: { type: string, url: string }[] = [];
  stemVolumes: { [key: string]: number } = {
    bass: 0.5,
    drums: 0.5,
    melody: 0.5,
    vocals: 0.5
  };
  currentTime = 0;
  duration = 0;
  isSeeking = false;
  volume = 1;
  isToggleBlocked = false;
  likeStatus: 'like' | 'dislike' | null = null;
  private likedUpdateSub!: Subscription;


  showEffects = false;

  showModal = false;
  selectedTrackId = 0;

  openModal(trackId: number) {
    this.selectedTrackId = trackId;
    this.showModal = true;
  }

  onRightClickLike(event: MouseEvent) {
    event.preventDefault();
    if (!this.currentTrack) return;

    this.openModal(this.currentTrack.id);
  }

  closeModal = () => {
    this.showModal = false;
  };

  toggleEffects() {
    this.showEffects = !this.showEffects;
  }


  private mixerSettingsLoaded = false;
  private trackSub!: Subscription;
  private playbackSub!: Subscription;
  private timeSub!: Subscription;
  private needsSync = false;
  private stemVolumeTimers: { [key: string]: any } = {};
  private mainVolumeTimer: any = null;

  private likeStatusSub!: Subscription;

  likeTrack() {
    this.setLikeStatus('like');
  }

  dislikeTrack() {
    this.setLikeStatus('dislike');
  }

  // Spēlē iepriekšējo dziesmu no rindas
  playPrevious(): void {
    const prev = this.playerService.getPreviousTrack();
    if (prev) {
      this.playerService.setTrack(prev, true);
    }
  }

// Spēlē nākamo dziesmu no rindas
  playNext(): void {
    const next = this.playerService.getNextTrack();
    if (next) {
      this.playerService.setTrack(next, true);
    }
  }


  private activeFadeTimers: Map<HTMLAudioElement, any> = new Map();

  private fadeVolume(
    element: HTMLAudioElement,
    from: number,
    to: number,
    duration: number = 500
  ) {
    const existingTimer = this.activeFadeTimers.get(element);
    if (existingTimer) clearInterval(existingTimer);

    const steps = 30;
    const stepDuration = duration / steps;
    const delta = (to - from) / steps;

    let current = from;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += delta;
      element.volume = Math.max(0, Math.min(current, 1));
      if (step >= steps) {
        element.volume = to;
        clearInterval(timer);
        this.activeFadeTimers.delete(element);
      }
    }, stepDuration);

    this.activeFadeTimers.set(element, timer);
  }




  playerWidth = 642;
  readonly defaultWidth = 642;
  isResizing = false;
  minWidth = 420;
  maxWidth = 850;
  bounceClass = '';
  resizeThrottle = false;

  constructor(
    private playerService: PlayerService,
    private stemsMixerService: StemsMixerService,
    private cdr: ChangeDetectorRef,
    private trackLikesService: TrackLikesService,
    private authService: AuthService,
    private playlistUpdateService: PlaylistUpdateService,
  ) {}

  // Inicializācija, Angular dzīves cikls / subscriptions
  ngOnInit() {
    this.playerWidth = +localStorage.getItem('playerWidth')! || this.defaultWidth;
    this.emitWidth();

    this.likeStatusSub = this.playlistUpdateService.likeStatusChanged$.subscribe(() => {
      if (this.currentTrack?.id) {
        this.loadLikeStatus(this.currentTrack.id);
      }
    });

    this.trackSub = this.playerService.currentTrack$.subscribe(track => {
      if (track) {
        this.currentTrack = track;
        this.stems = track.stems || [];
        this.needsSync = true;

        this.loadLikeStatus(track.id);
      }
    });

    this.stemsMixerService.getMixerSettings().subscribe(settings => {
      this.mixerSettingsLoaded = true;
      this.isStemsMode = settings.is_stems_mode;
      this.stemVolumes = {
        bass: settings.bass_level ?? 0.5,
        drums: settings.drums_level ?? 0.5,
        melody: settings.melody_level ?? 0.5,
        vocals: settings.vocals_level ?? 0.5
      };
      this.cdr.detectChanges();

      // startejam syncPlaybackState() tikai kad mixer settings ir ieladeti
      if (this.isPlaying) {
        this.syncPlaybackState();
      }
    });


    const storedVolume = localStorage.getItem('playerVolume');
    this.volume = storedVolume ? +storedVolume : 1;

    this.playbackSub = this.playerService.isPlaying$.subscribe(playing => {
      this.isPlaying = playing;
      this.syncPlaybackState();
    });

    this.timeSub = this.playerService.currentTime$.subscribe(time => {
      this.currentTime = time;
    });

    this.likedUpdateSub = this.trackLikesService.getLikedPlaylistUpdateObservable().subscribe(() => {
      // like atjaunosana ja ir dzests no like saraksta
      if (this.currentTrack) {
        this.loadLikeStatus(this.currentTrack.id);
      }
    });
  }

  // Kad audio elementi ir pieejami DOM
  ngAfterViewInit() {
    this.audioElement.nativeElement.volume = this.volume;
    this.audioElement.nativeElement.addEventListener('loadedmetadata', () => {
      this.duration = this.audioElement.nativeElement.duration;
    });
    this.audioElement.nativeElement.addEventListener('ended', () => {
      this.onEnded();
    });
    this.setupTimeTracking();
    this.updateSliderValue();

  }

  ngAfterViewChecked() {
    if (this.needsSync && this.areAllAudioElementsReady()) {
      this.needsSync = false;
      this.syncPlaybackState();
    }
  }

  ngOnChanges() { // slider balta krasa
    this.updateSliderValue();
  }

  ngOnDestroy() {
    this.trackSub?.unsubscribe();
    this.playbackSub?.unsubscribe();
    this.timeSub?.unsubscribe();
    this.likedUpdateSub?.unsubscribe();
    this.likeStatusSub?.unsubscribe();
  }

  setLikeStatus(status: 'like' | 'dislike') {
    if (!this.currentTrack) return;

    const newStatus = this.likeStatus === status ? null : status; // nemam nost uz otro kliku
    this.trackLikesService.setTrackLike(this.currentTrack.id, newStatus).subscribe({
      next: () => {
        this.likeStatus = newStatus;
      },
      error: (err) => {
        console.error('Neizdevās saglabāt like statusu:', err);
      }
    });
  }

  loadLikeStatus(trackId: number) {
    this.trackLikesService.getUserTrackLike(trackId).subscribe({
      next: (res) => {
        this.likeStatus = res?.like_status || null;
      },
      error: (err) => {
        console.error('Kļūda ielādējot like statusu:', err);
      }
    });
  }




  // Pamatfunkcionalitāte atskaņošanai

  // Atskaņo jaunu celiņu
  playTrack() {
    this.syncPlaybackState();
  }

  // Sinhronizē atskaņošanas stāvokli
  private syncPlaybackState() {
    const isPlaying = this.playerService.getIsPlaying();
    if (isPlaying) {
      this.playAll();
    } else {
      this.pauseAll();
    }
  }

  // Apstādina visus audio elementus
  private pauseAll(): void {
    this.audioElement.nativeElement.pause();
    this.stemAudioElements.forEach(ref => ref.nativeElement.pause());
  }

  // Atskaņo visus audio elementus sinhroni
  private async playAll(): Promise<void> {
    if (!this.mixerSettingsLoaded || !this.currentTrack) return;

    try {

      await this.waitForAllAudioToBeReady();


      this.updateStemsEffectiveVolume(); // ← сразу применяет правильные volume
      this.audioElement.nativeElement.volume = this.isStemsMode ? 0 : this.volume;


      const syncTime = this.currentTime;
      this.audioElement.nativeElement.currentTime = syncTime;
      this.stemAudioElements.forEach(ref => {
        ref.nativeElement.currentTime = syncTime;
      });


      const playPromises = [
        this.audioElement.nativeElement.play().catch(e => console.warn('Main play error:', e)),
        ...this.stemAudioElements.map(ref =>
          ref.nativeElement.play().catch(e => console.warn('Stem play error:', e)))
      ];
      await Promise.all(playPromises);

    } catch (e) {
      console.error('PlayAll error:', e);
    }
  }



  private waitForAllAudioToBeReady(): Promise<void> {
    const audioElements: HTMLAudioElement[] = [
      this.audioElement.nativeElement,
      ...this.stemAudioElements.map(ref => ref.nativeElement)
    ];

    const readinessPromises = audioElements.map(el => {
      return new Promise<void>((resolve) => {
        if (el.readyState >= 3) {
          resolve();
        } else {
          el.addEventListener('canplaythrough', () => resolve(), { once: true });
        }
      });
    });

    return Promise.all(readinessPromises).then(() => {});
  }

  private areAllAudioElementsReady(): boolean {
    if (!this.audioElement?.nativeElement) return false;
    if (this.stemAudioElements.length !== this.stems.length) return false;

    return this.stemAudioElements.toArray().every(ref =>
      ref.nativeElement.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
    );
  }

  // Sekojam atskaņošanas pozīcijai
  setupTimeTracking() {
    this.audioElement.nativeElement.addEventListener('timeupdate', () => {
      if (!this.isStemsMode && !this.isSeeking) {
        this.currentTime = this.audioElement.nativeElement.currentTime;
        this.playerService.setCurrentTime(this.currentTime);
      }
    });

    setInterval(() => {
      if (this.isStemsMode && !this.isSeeking && this.isPlaying && this.stemAudioElements.length > 0) {
        const mainStem = this.stemAudioElements.first?.nativeElement;
        if (mainStem) {
          this.currentTime = mainStem.currentTime;
          this.playerService.setCurrentTime(this.currentTime);
        }
      }
    }, 250);
  }

  // Kad dziesma beidzas
  onEnded() {
    this.isPlaying = false;
    this.currentTime = 0;
    this.playerService.setCurrentTime(0);
  }





  // Skaļums un režīmi

  setVolume(value: number) {
    this.volume = value;
    localStorage.setItem('playerVolume', value.toString());

    if (this.isStemsMode) {
      this.updateStemsEffectiveVolume();
    } else {
      this.audioElement.nativeElement.volume = value;
    }
  }

  // Kad tiek ievadīts jauns skaļuma līmenis
  onVolumeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.setVolume(+input.value);
  }

  onVolumeChangeEnd(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    this.volume = value;
    localStorage.setItem('playerVolume', value.toString());
  }

  onVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = +input.value;

    this.volume = value;

    if (this.isStemsMode) {
      this.updateStemsEffectiveVolume();
    } else {
      this.audioElement.nativeElement.volume = value;
    }

    // Atceļ iepriekšējo taimeri, ja ir
    if (this.mainVolumeTimer) {
      clearTimeout(this.mainVolumeTimer);
    }

    // Saglabā vērtību pēc 400ms, ja nav citu izmaiņu
    this.mainVolumeTimer = setTimeout(() => {
      localStorage.setItem('playerVolume', value.toString());
      this.mainVolumeTimer = null;
    }, 400);
  }



  // Pārslēdz režīmu starp parasto un stems
  onStemsToggle(event: Event): void {
    if (this.isToggleBlocked || !this.currentTrack) return;

    const input = event.target as HTMLInputElement;
    const newMode = input.checked;

    this.isToggleBlocked = true;

    const fadeDuration = 300;

    this.stemsMixerService.updateMixerSettings({ is_stems_mode: newMode }).subscribe({
      next: () => {
        this.isStemsMode = newMode;

        if (newMode) {
          this.fadeVolume(this.audioElement.nativeElement, this.volume, 0, fadeDuration);

          for (const type of Object.keys(this.stemVolumes)) {
            const ref = this.stemAudioElements.find(
              ref => ref.nativeElement.dataset['type']?.trim() === type
            );
            if (ref) {
              const el = ref.nativeElement;
              const targetVolume = this.calculateStemVolume(type);
              this.fadeVolume(el, 0, targetVolume, fadeDuration);
            }
          }
        } else {
          this.fadeVolume(this.audioElement.nativeElement, 0, this.volume, fadeDuration);

          this.stemAudioElements.forEach(ref => {
            this.fadeVolume(ref.nativeElement, ref.nativeElement.volume, 0, fadeDuration);
          });
        }

        setTimeout(() => this.isToggleBlocked = false, fadeDuration + 100);
      },
      error: (err) => {
        console.error('Stems toggle failed:', err);
        this.isToggleBlocked = false;
      }
    });
  }


  private calculateStemVolume(type: string): number {
    const base = this.stemVolumes[type] ?? 0.5;
    const boosted = Math.max(0, Math.min((base - 0.5) * 2 + 1.0, 1.5));
    let volume = boosted * this.volume;

    volume = Math.max(0, Math.min(volume, 1));

    return volume;
  }

  private applyStemVolume(type: string): void {
    const value = this.stemVolumes[type] ?? 0.5;
    const ref = this.stemAudioElements.find(
      ref => ref.nativeElement.dataset['type']?.trim() === type
    );
    if (!ref) return;

    const el = ref.nativeElement;
    const boosted = Math.max(0, Math.min((value - 0.5) * 2 + 1.0, 1.5));
    let effectiveVolume = this.isStemsMode ? boosted * this.volume : 0;

    effectiveVolume = Math.max(0, Math.min(effectiveVolume, 1));

    el.volume = effectiveVolume;
  }

  // Atjaunina katras stems reālo skaļumu
  private updateStemsEffectiveVolume(): void {
    if (!this.stemAudioElements || this.stemAudioElements.length === 0) return;

    this.stemAudioElements.forEach(ref => {
      const el = ref.nativeElement;
      const type = el.dataset['type']?.trim();

      if (!type) {
        console.warn('Stem audio missing data-type:', el);
        return;
      }

      const baseVolume = this.stemVolumes[type] ?? 0.5;
      const boosted = Math.max(0, Math.min((baseVolume - 0.5) * 2 + 1.0, 1.5));
      let effectiveVolume = this.isStemsMode ? boosted * this.volume : 0;


      effectiveVolume = Math.max(0, Math.min(effectiveVolume, 1));

      el.volume = effectiveVolume;

      // console.log(`[${type}] base=${baseVolume}, boost=${boosted}, main=${this.volume}, → applied=${effectiveVolume}`);
    });

    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.volume = this.isStemsMode ? 0 : Math.max(0, Math.min(this.volume, 1));
    }
  }

  resetStemVolumes(): void {
    // Atjauno katra ceļa vērtību lokāli uz 0.5
    for (const type of Object.keys(this.stemVolumes)) {
      this.stemVolumes[type] = 0.5;
    }

    // Pielieto skaņas skaļumu momentāni
    this.updateStemsEffectiveVolume();

    // Saglabā izmaiņas DB (visi ceļi vienā pieprasījumā)
    this.stemsMixerService.updateMixerSettings({
      bass_level: 0.5,
      drums_level: 0.5,
      melody_level: 0.5,
      vocals_level: 0.5
    }).subscribe({
      next: () => {
        console.log('Stems skaļumi veiksmīgi atiestatīti uz servera');
      },
      error: (err) => {
        console.error('Neizdevās saglabāt skaļumu iestatījumus:', err);
      }
    });
  }

  private applyFinalVolumeSettings(isFromToggle = false) {
    if (this.isStemsMode) {
      this.stemAudioElements.forEach(ref => {
        const type = ref.nativeElement.dataset['type'] ?? '';
        const targetVolume = this.calculateStemVolume(type);
        this.fadeVolume(ref.nativeElement, 0, targetVolume, 300);
      });

      this.fadeVolume(this.audioElement.nativeElement, this.volume, 0, 300);
    } else {
      this.fadeVolume(this.audioElement.nativeElement, 0, this.volume, 300);
    }
  }


  // Stem kontrole (slideri)
  onStemVolumeInput(type: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = +input.value;

    // Atjaunojam lokālo vērtību
    this.stemVolumes[type] = value;

    // Pielietojam uzreiz
    this.applyStemVolume(type);

    // Atceļ iepriekšējo taimeri, ja ir
    if (this.stemVolumeTimers[type]) {
      clearTimeout(this.stemVolumeTimers[type]);
    }

    // Nosūta pēc 400ms ja vairāk nav izmaiņu
    this.stemVolumeTimers[type] = setTimeout(() => {
      console.log(`[DB] Saglabājam skaļumu "${type}" → ${value}`);
      this.stemsMixerService.updateMixerSettings({ [`${type}_level`]: value }).subscribe();
      delete this.stemVolumeTimers[type]; // notīrām
    }, 400);
  }




  // Progress bar un vilkšana

  // Kad sākas vilkšana
  seek(event: any) {
    this.currentTime = +event.target.value;
    this.isSeeking = true;
  }




  private updateInitialVolumes() {
    this.stemAudioElements.forEach(ref => {
      ref.nativeElement.volume = 0;
    });

    this.audioElement.nativeElement.volume = this.isStemsMode ? 0 : this.volume;
  }

  // Kad beidzas vilkšana
  onSeekEnd(): void {
    this.isSeeking = false;

    const newTime = this.currentTime;

    // Uzstāda jauno laiku visiem audio elementiem
    this.audioElement.nativeElement.currentTime = newTime;
    this.stemAudioElements.forEach(ref => {
      ref.nativeElement.currentTime = newTime;
    });

    // Ja bija spēlēšana — atsākam no jauna laika
    if (this.isPlaying) {
      this.resumeAfterSeek();
    }
  }

  private resumeAfterSeek(): void {
    if (this.isStemsMode) {
      // Tikai stem audio
      this.stemAudioElements.forEach(ref => ref.nativeElement.play().catch(() => {}));
    } else {
      // Tikai galvenais audio
      this.audioElement.nativeElement.play().catch(() => {});
    }
  }


  // Papildu UI, resize, karstie taustiņi utt

  // Pārslēdz atskaņošanu/pauzi
  togglePlay() {
    this.playerService.togglePlayback();
  }

  // Formatē laiku MM:SS
  formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  // Resize loģika
  onResizeStart(event: MouseEvent) {
    this.isResizing = true;
    event.preventDefault();
    document.body.classList.add('no-transition');
  }

  @HostListener('document:mousemove', ['$event'])
  onResizeMove(event: MouseEvent) {
    if (!this.isResizing || this.resizeThrottle) return;
    this.resizeThrottle = true;
    setTimeout(() => {
      const newWidth = window.innerWidth - event.clientX;
      const clamped = Math.max(this.minWidth, Math.min(newWidth, this.maxWidth));
      this.playerWidth = clamped;
      localStorage.setItem('playerWidth', clamped.toString());
      this.emitWidth();
      this.resizeThrottle = false;
    }, 16);
  }

  @HostListener('document:mouseup')
  onResizeEnd() {
    this.isResizing = false;
    document.body.classList.remove('no-transition');
  }

  // Atiestata platumu
  onResizeReset() {
    this.playerWidth = this.defaultWidth;
    localStorage.setItem('playerWidth', this.defaultWidth.toString());
    this.emitWidth();
    this.bounceClass = 'bounce';
    setTimeout(() => this.bounceClass = '', 400);
  }

  // atskaņošana ar Space
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement).tagName.toLowerCase();
    const isTextInput = tag === 'input' || tag === 'textarea';
    if (event.code === 'Space' && !isTextInput) {
      event.preventDefault();
      this.togglePlay();
    }
  }

  // Emitē player platumu
  emitWidth() {
    this.widthChanged.emit(this.playerWidth);
  }

  updateSliderValue() {
    const percentage = (this.currentTime / this.duration) * 100;
    document.documentElement.style.setProperty('--value', `${percentage}`);
  }
}
