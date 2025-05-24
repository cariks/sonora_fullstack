// Importē nepieciešamos Angular elementus un servisus
import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';
import { StemsMixerService } from '../../services/stems-mixer.service';
import { ViewChildren, QueryList } from '@angular/core';
import {error} from "@angular/compiler-cli/src/transformers/util";
import { ChangeDetectorRef } from '@angular/core';



// Komponents, kas atbild par mūzikas atskaņošanu un playera interfeisu
@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @ViewChild('audioRef') audioElement!: ElementRef<HTMLAudioElement>; // Atsauce uz audio HTML elementu
  @Output() widthChanged = new EventEmitter<number>(); // Lai paziņotu par playera platuma izmaiņām
  @ViewChildren('stemAudioRef') stemAudioElements!: QueryList<ElementRef<HTMLAudioElement>>;


  // Abonementi priekš strāvojošo datu plūsmām
  private trackSub!: Subscription;
  private playbackSub!: Subscription;
  private timeSub!: Subscription;

  constructor(private playerService: PlayerService,
              private stemsMixerService: StemsMixerService,
              private cdr: ChangeDetectorRef,
  ) {}

  // Lietotāja stāvokļa mainīgie
  isSeeking = false; // Norāda, vai lietotājs velk laika joslu

  currentTrack: any = null; // Pašreizējā dziesma
  isPlaying = false; // Vai dziesma tiek atskaņota
  duration = 0; // Kopējais dziesmas ilgums
  currentTime = 0; // Pašreizējais atskaņošanas laiks

  volume = 1; // Standarta skaļums

  fadeInterval: any = null;


  isStemsMode = false;
  stems: { type: string, url: string }[] = [];
  stemVolumes: { [key: string]: number } = {
    bass: 0.5,
    drums: 0.5,
    melody: 0.5,
    vocals: 0.5
  };
  private stemVolumeUpdateTimeouts: { [key: string]: any } = {};
  private stemFadeVolume = 0.5;
  private stemsToggleInProgress = false;
  private stemsNeedInit = false; // Vai ir vajadziga stems atksanosana pec Render
  mixerSettingsLoaded = false;



  // Atskaņotāja izmēru mainīgie
  playerWidth = 474;
  readonly defaultWidth = 474;
  isResizing = false;
  minWidth = 280;
  maxWidth = 900;
  bounceClass = '';
  resizeThrottle = false;



  // Iniciē komponenti un abonē nepieciešamos datus no servisa
  ngOnInit() {
    // Mēģina nolasīt saglabāto atskaņotāja platumu no pārlūka lokālās atmiņas
    const stored = localStorage.getItem('playerWidth');
    // Ja platums nav saglabāts, tiek izmantots noklusētais platums
    this.playerWidth = stored ? +stored : this.defaultWidth;
    // Ja platums nav saglabāts, tiek izmantots noklusētais platums
    this.emitWidth();

    this.trackSub = this.playerService.currentTrack$.subscribe(track => {
      if (track) {
        this.currentTrack = track;
        this.stems = track.stems || []; // Ielādē stems, ja tādi ir
        this.playTrack();
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



    // Atskaņošanas statusa maiņa
    this.playbackSub = this.playerService.isPlaying$.subscribe(playing => {
      this.isPlaying = playing;
      this.syncPlaybackState();
    });


    // Sinhronizē globālo laiku
    this.timeSub = this.playerService.currentTime$.subscribe((time) => {
      this.currentTime = time; // Atjauno komponentes lokālo stāvokli
    });
  }

  // Iestatījumi pēc tam, kad HTML elements ir pieejams DOM
  ngAfterViewInit() {
    this.audioElement.nativeElement.volume = this.volume;

    const audio = this.audioElement.nativeElement;

    audio.addEventListener('loadedmetadata', () => {
      this.duration = audio.duration;
    });


    this.setupTimeTracking();

    audio.addEventListener('ended', () => {
      this.onEnded();
    });
  }

  private setupTimeTracking() {
    const audio = this.audioElement.nativeElement;

    audio.addEventListener('timeupdate', () => {
      if (this.isStemsMode) return;
      if (!this.isSeeking) {
        this.currentTime = audio.currentTime;
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



  // Atbrīvo resursus
  ngOnDestroy() {
    this.trackSub?.unsubscribe(); // Atceļ dziesmas izmaiņu abonementu
    this.playbackSub?.unsubscribe(); // Atceļ atskaņošanas statusa abonementu
    this.timeSub?.unsubscribe(); // Atceļ laika izsekošanas abonementu
  }

  // Atskaņo pašreizējo dziesmu no saglabātā laika
  playTrack() {
    this.isPlaying = false;
    const audio = this.audioElement.nativeElement;

    if (!this.isStemsMode) {
      const canPlayHandler = () => {
        const savedTime = this.playerService.getCurrentTime();
        if (!this.isSeeking && savedTime > 0) {
          audio.currentTime = savedTime;
        }

        if (this.playerService.getIsPlaying()) {
          audio.play();
        }

        audio.removeEventListener('canplaythrough', canPlayHandler);
      };

      audio.addEventListener('canplaythrough', canPlayHandler);
    } else {
      this.stemsNeedInit = true;
      this.cdr.detectChanges();
    }
  }

  ngAfterViewChecked() {
    if (this.stemsNeedInit && this.stemAudioElements.length > 0) {
      this.stemsNeedInit = false;
      this.initStemsPlayback();
    }
  }

  private initStemsPlayback() {
    this.waitForAllStemsToLoad().then(() => {
      const currentTime = this.currentTime;
      this.stemAudioElements.forEach(ref => {
        const el = ref.nativeElement;
        el.currentTime = currentTime;
        const type = el.dataset['type'] ?? '';
        el.volume = this.stemVolumes[type] ?? 0.5;
      });

      this.syncPlaybackState();
    });
  }

  private syncPlaybackState() {
    const isPlaying = this.playerService.getIsPlaying();

    if (this.isStemsMode) {
      this.stemAudioElements.forEach(ref => {
        const el = ref.nativeElement;
        if (isPlaying) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      });
    } else {
      const audio = this.audioElement.nativeElement;
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }
  }



  private waitForAllStemsToLoad(): Promise<void> {
    const elements = this.stemAudioElements.toArray().map(ref => ref.nativeElement);

    const promises = elements.map(el => {
      return new Promise<void>((resolve) => {
        if (el.readyState >= 3) {
          resolve();
        } else {
          const onReady = () => {
            el.removeEventListener('canplaythrough', onReady);
            resolve();
          };
          el.addEventListener('canplaythrough', onReady);
        }
      });
    });

    return Promise.all(promises).then(() => {});
  }





  setVolume(value: number) {
    this.volume = value;
    const audio = this.audioElement.nativeElement;
    audio.volume = value;

    localStorage.setItem('playerVolume', value.toString());
  }

  onVolumeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    this.setVolume(value);
  }

  // Start/stop
  togglePlay() {
    this.playerService.togglePlayback();
  }

  // Tiek izsaukta kad lietotājs velk slīdni
  seek(event: any) {
    this.currentTime = +event.target.value;
    this.isSeeking = true; // Lietotajs vel velk slidni
  }

  // Lietotājs atlaiž slīdni, fiksē laiku
  onSeekEnd() {
    this.isSeeking = false;
    this.playerService.setCurrentTime(this.currentTime);

    if (this.isStemsMode) {
      // Ставим паузу всем дорожкам
      this.stemAudioElements.forEach(ref => {
        ref.nativeElement.pause();
      });

      // Обновляем позиции
      this.stemAudioElements.forEach(ref => {
        ref.nativeElement.currentTime = this.currentTime;
      });

      // Дожидаемся полной готовности всех stems
      this.waitForAllStemsToLoad().then(() => {
        if (this.playerService.getIsPlaying()) {
          this.stemAudioElements.forEach(ref => {
            ref.nativeElement.play().catch(() => {});
          });
        }
      });
    } else {
      const audio = this.audioElement.nativeElement;

      if (audio.readyState < 1) {
        const waitForReady = () => {
          audio.currentTime = this.currentTime;
          audio.removeEventListener('loadedmetadata', waitForReady);
        };
        audio.addEventListener('loadedmetadata', waitForReady);
      } else {
        audio.currentTime = this.currentTime;
      }

      if (this.playerService.getIsPlaying()) {
        audio.play().catch(() => {});
      }
    }
  }



  // Formatē laiku sekundes uz MM:SS
  formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  fadeOut(audio: HTMLAudioElement, callback: () => void) {
    if (this.fadeInterval) clearInterval(this.fadeInterval);

    const step = 0.01;
    const speed = 15;
    this.fadeInterval = setInterval(() => {
      if (audio.volume > step) {
        audio.volume -= step;
      } else {
        audio.volume = 0;
        clearInterval(this.fadeInterval);
        callback();
      }
    }, speed);
  }

  fadeInStem(audio: HTMLAudioElement, targetVolume: number) {
    let volume = 0;
    audio.volume = 0;

    const step = 0.1;
    const speed = 15;

    const interval = setInterval(() => {
      volume += step;
      if (volume < targetVolume) {
        audio.volume = volume;
      } else {
        audio.volume = targetVolume;
        clearInterval(interval);
      }
    }, speed);
  }


  // Tiek izsaukts kad dziesma ir beigusies
  onEnded() {
    this.isPlaying = false; // Statuss = beigts
    this.currentTime = 0;
    this.playerService.setCurrentTime(0); // Informē servisu
  }

  onStemsToggle() {
    if (this.stemsToggleInProgress) return;
    this.stemsToggleInProgress = true;

    const newMode = this.isStemsMode; // уже изменено через ngModel!
    const isPlaying = this.playerService.getIsPlaying();
    const audio = this.audioElement.nativeElement;

    this.stemsMixerService.updateMixerSettings({ is_stems_mode: !!newMode }).subscribe({
      next: () => {
        this.stemsToggleInProgress = false;

        if (newMode) {
          const transitionTime = audio.currentTime;

          this.waitForAllStemsToLoad().then(() => {

            if (isPlaying) {

              this.fadeOut(audio, () => {
                audio.pause();
              });

              this.stemAudioElements.forEach((ref, index) => {
                const el = ref.nativeElement;
                const type = el.dataset['type'] ?? '';
                const targetVolume = this.stemVolumes[type] ?? 0.5;

                el.currentTime = transitionTime;
                el.volume = 0;

                setTimeout(() => {
                  el.play().catch(() => {});
                  this.fadeInStem(el, targetVolume);
                }, 1);


              });
            }

          });
        } else {

          this.stemAudioElements.forEach(ref => {
            this.fadeOut(ref.nativeElement, () => {
              ref.nativeElement.pause();
            });
          });

          const audio = this.audioElement.nativeElement;
          audio.currentTime = this.currentTime;

          if (isPlaying) {
            audio.volume = 0;
            audio.play().then(() => {
              this.fadeInStem(audio, this.volume);
            });
          }
        }
      },
      error: (err) => {
        console.error('Update failed:', err);
        this.stemsToggleInProgress = false;
      }
    });
  }





  onStemVolumeChange(type: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = +input.value;

    this.stemVolumes[type] = value;

    const audioRef = this.stemAudioElements.find(ref =>
      ref.nativeElement.dataset['type'] === type
    );
    if (audioRef) {
      audioRef.nativeElement.volume = value;
    }
  }

  onStemVolumeChangeEnd(type: string) {
    const value = this.stemVolumes[type];
    this.stemsMixerService.updateMixerSettings({ [`${type}_level`]: value }).subscribe();
  }


  // Atskaņotāja izmēru maiņa

  onResizeStart(event: MouseEvent) {
    this.isResizing = true; // Iestata stāvokli, ka šobrīd notiek izmēra maiņa
    event.preventDefault();
    document.body.classList.add('no-transition'); // Pievieno CSS klasi, lai izslēgtu animācijas vilkšanas laikā
  }


// Atgriež atskaņotāja platumu uz noklusēto vērtību
  onResizeReset() {
    this.playerWidth = this.defaultWidth; // Iestata platumu uz sākotnējo vērtību
    localStorage.setItem('playerWidth', this.defaultWidth.toString()); // Saglabā šo platumu lokālajā atmiņā
    this.emitWidth(); // Informē vecākkomponentu par izmaiņām

    // Piešķir animācijas klasi, lai parādītu "atsitiena" efektu
    this.bounceClass = 'bounce';
    setTimeout(() => {
      this.bounceClass = ''; // Noņem animācijas klasi pēc īsa brīža
    }, 400);
  }
// Kad lietotājs velk peli šī funkcija izsaucas uz katru peles kustību
  @HostListener('document:mousemove', ['$event'])
  onResizeMove(event: MouseEvent) {
    // Ja šobrīd nenotiek izmēra maiņa vai tiek izmantots "throttle", pārtrauc funkciju
    if (!this.isResizing || this.resizeThrottle) return;

    this.resizeThrottle = true; // Uzliek īslaicīgu ierobežojumu (16ms), lai neizsauktu pārāk bieži

    setTimeout(() => {
      // Aprēķina jauno platumu, pamatojoties uz peles koordinātu
      const newWidth = window.innerWidth - event.clientX;

      // Ierobežo platumu starp minimālo un maksimālo vertību
      const clamped = Math.max(this.minWidth, Math.min(newWidth, this.maxWidth));
      this.playerWidth = clamped;
      // Saglabā jauno platumu lokālajā atmiņā
      localStorage.setItem('playerWidth', clamped.toString());
      // Paziņo citiem komponentiem par platuma izmaiņām
      this.emitWidth();

      this.resizeThrottle = false; // Atļauj nakamo peles kustības apstrādi
    }, 16); // 16ms - smooth animacija
  }

// Kad lietotājs atlaiž peles pogu apstājas izmēra maiņa
  @HostListener('document:mouseup')
  onResizeEnd() {
    this.isResizing = false; // Atsāk vilkšanas režīmu
    document.body.classList.remove('no-transition'); // Noņem CSS klasi, lai atgrieztos animācijas
  }

  // Pauze, kad tiek nospiests taustiņš SPACE
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    // Pārbaude: vai SPACE un fokuss NAV ievades/teksta laukumā.
    const tag = (event.target as HTMLElement).tagName.toLowerCase();
    const isTextInput = tag === 'input' || tag === 'textarea';

    if (event.code === 'Space' && !isTextInput) {
      event.preventDefault(); // Bez lapas skrollešanas
      this.togglePlay(); // Play / pauza
    }
  }


// Nosūta pašreizējo platumu vecākkomponentam
  emitWidth() {
    this.widthChanged.emit(this.playerWidth); // Izpilda @Output notikumu ar jauno platuma vērtību
  }

  protected readonly HTMLInputElement = HTMLInputElement;
}
