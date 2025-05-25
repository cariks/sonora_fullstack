// Importē nepieciešamos Angular elementus un servisus
import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';
import { StemsMixerService } from '../../services/stems-mixer.service';
import { ViewChildren, QueryList } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';

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


  private mixerSettingsLoaded = false;
  private trackSub!: Subscription;
  private playbackSub!: Subscription;
  private timeSub!: Subscription;
  private needsSync = false;

  private fadeVolume(
    element: HTMLAudioElement,
    from: number,
    to: number,
    duration: number = 300
  ) {
    const steps = 30;
    const stepDuration = duration / steps;
    const delta = (to - from) / steps;

    let current = from;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current += delta;
      element.volume = Math.max(0, Math.min(current, 1));

      if (step >= steps) {
        element.volume = to;
        clearInterval(interval);
      }
    }, stepDuration);
  }



  playerWidth = 474;
  readonly defaultWidth = 474;
  isResizing = false;
  minWidth = 280;
  maxWidth = 900;
  bounceClass = '';
  resizeThrottle = false;

  constructor(
    private playerService: PlayerService,
    private stemsMixerService: StemsMixerService,
    private cdr: ChangeDetectorRef
  ) {}

  // Inicializācija
  ngOnInit() {
    this.playerWidth = +localStorage.getItem('playerWidth')! || this.defaultWidth;
    this.emitWidth();

    this.trackSub = this.playerService.currentTrack$.subscribe(track => {
      if (track) {
        this.currentTrack = track;
        this.stems = track.stems || [];
        this.needsSync = true;
      }
    });

    this.stemsMixerService.getMixerSettings().subscribe(settings => {
      if (!this.mixerSettingsLoaded) {
        this.mixerSettingsLoaded = true;
        this.isStemsMode = settings.is_stems_mode;
        this.stemVolumes = {
          bass: settings.bass_level ?? 0.5,
          drums: settings.drums_level ?? 0.5,
          melody: settings.melody_level ?? 0.5,
          vocals: settings.vocals_level ?? 0.5
        };
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
  }

  ngAfterViewChecked() {
    if (this.needsSync && this.audioElement && this.stemAudioElements.length >= this.stems.length) {
      this.needsSync = false;
      this.syncPlaybackState(); // playAll
    }
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


  // Atskaņo jaunu celiņu
  playTrack() {
    this.syncPlaybackState();
  }

  // Atskaņo visus audio elementus sinhroni
  private async playAll(): Promise<void> {
    const audio = this.audioElement.nativeElement;
    const currentTime = this.currentTime;

    // ⏳ Pagaida, kamēr visi audio elementi gatavi
    await this.waitForAllAudioToBeReady();

    // Uzliekam sinhrono laiku
    audio.currentTime = currentTime;
    const audioPlay = audio.play().catch(() => {});

    const stemPlays = this.stemAudioElements.map(ref => {
      const el = ref.nativeElement;
      const type = el.dataset['type'] ?? '';
      el.currentTime = currentTime;
      return el.play().catch(() => {});
    });

    try {
      await Promise.all([audioPlay, ...stemPlays]);
    } catch (e) {
      console.warn('Kļūda atskaņojot audio:', e);
    }

    // Skaļumi
    this.audioElement.nativeElement.volume = this.isStemsMode ? 0 : this.volume;
    this.updateStemsEffectiveVolume();
  }



  // Apstādina visus audio elementus
  private pauseAll(): void {
    this.audioElement.nativeElement.pause();
    this.stemAudioElements.forEach(ref => ref.nativeElement.pause());
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

  // Pārslēdz režīmu starp parasto un stems
  onStemsToggle() {
    if (this.isToggleBlocked) return; // Bloķē, ja jau darbojas

    this.isToggleBlocked = true;
    const newMode = !this.isStemsMode;

    this.stemsMixerService.updateMixerSettings({ is_stems_mode: newMode }).subscribe({
      next: () => {
        const fadeDuration = 500;
        const main = this.audioElement.nativeElement;

        // Stems fade-in/out
        this.stemAudioElements.forEach(ref => {
          const el = ref.nativeElement;
          const type = el.dataset['type'] ?? '';
          const base = this.stemVolumes[type] ?? 0.5;

          let adjusted = (base - 0.5) * 2 + 1.0;
          adjusted = Math.max(0, Math.min(adjusted, 1.5));
          const finalVolume = adjusted * this.volume;

          if (newMode) {
            this.fadeVolume(el, 0, finalVolume, fadeDuration);
          } else {
            this.fadeVolume(el, el.volume, 0, fadeDuration);
          }
        });

        // Main audio fade
        if (newMode) {
          this.fadeVolume(main, this.volume, 0, fadeDuration);
        } else {
          this.fadeVolume(main, 0, this.volume, fadeDuration);
        }

        this.isStemsMode = newMode;

        // Atbloķējam pēc 1 sekundes --- toggle block
        setTimeout(() => {
          this.isToggleBlocked = false;
        }, 500);
      },
      error: (err) => {
        console.warn('Neizdevās pārslēgt režīmu:', err);
        this.isToggleBlocked = false;
      }
    });
  }







  // Kad tiek mainīts individuālais stems skaļums
  onStemVolumeChange(type: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    this.stemVolumes[type] = value;
    this.updateStemsEffectiveVolume();
  }

  // Kad tiek apstiprināta skaļuma izmaiņa
  onStemVolumeChangeEnd(type: string) {
    const value = this.stemVolumes[type];
    this.stemsMixerService.updateMixerSettings({ [`${type}_level`]: value }).subscribe();
  }

  // Kad beidzas vilkšana
  onSeekEnd() {
    this.isSeeking = false;
    this.playerService.setCurrentTime(this.currentTime);

    this.audioElement.nativeElement.currentTime = this.currentTime;
    this.stemAudioElements.forEach(ref => ref.nativeElement.currentTime = this.currentTime);

    // 🧠 Pāratjauno sinhrono atskaņošanu
    if (this.isPlaying) {
      this.playAll();
    }
  }


  // Kad sākas vilkšana
  seek(event: any) {
    this.currentTime = +event.target.value;
    this.isSeeking = true;
  }

  // Pārslēdz atskaņošanu/pauzi
  togglePlay() {
    this.playerService.togglePlayback();
  }

  // Uzstāda kopējo skaļumu
  setVolume(value: number) {
    this.volume = value;
    localStorage.setItem('playerVolume', value.toString());

    if (!this.isStemsMode) {
      this.audioElement.nativeElement.volume = value;
    } else {
      this.updateStemsEffectiveVolume();
    }
  }

  // Atjaunina katras stems reālo skaļumu
  private updateStemsEffectiveVolume() {
    const boostFactor = 2; // 0.5 → 100%, 1.0 → 200%, но мы ограничим ниже

    this.stemAudioElements.forEach(ref => {
      const el = ref.nativeElement;
      const type = el.dataset['type'] ?? '';
      const base = this.stemVolumes[type] ?? 0.5;

      // 🔈 Pielāgotā skaļuma aprēķins
      let adjusted = (base - 0.5) * boostFactor + 1.0; // 0.5 → 1.0; 1.0 → 2.0; 0 → 0
      adjusted = Math.max(0, Math.min(adjusted, 1.5)); // Maks. 150%

      el.volume = this.isStemsMode ? adjusted * this.volume : 0;
    });
  }



  // Kad tiek ievadīts jauns skaļuma līmenis
  onVolumeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.setVolume(+input.value);
  }

  // Formatē laiku MM:SS
  formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  // Kad dziesma beidzas
  onEnded() {
    this.isPlaying = false;
    this.currentTime = 0;
    this.playerService.setCurrentTime(0);
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

  // Īsceļš: atskaņošana ar Space
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
}
