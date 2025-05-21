// Importē nepieciešamos Angular elementus un servisus
import { Component, ElementRef, EventEmitter, HostListener, Output, ViewChild } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';

// Komponents, kas atbild par mūzikas atskaņošanu un playera interfeisu
@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @ViewChild('audioRef') audioElement!: ElementRef<HTMLAudioElement>; // Atsauce uz audio HTML elementu
  @Output() widthChanged = new EventEmitter<number>(); // Lai paziņotu par playera platuma izmaiņām

  // Abonementi priekš strāvojošo datu plūsmām
  private trackSub!: Subscription;
  private playbackSub!: Subscription;
  private timeSub!: Subscription;

  constructor(private playerService: PlayerService) {}

  // Lietotāja stāvokļa mainīgie
  isSeeking = false; // Norāda, vai lietotājs velk laika joslu

  currentTrack: any = null; // Pašreizējā dziesma
  isPlaying = false; // Vai dziesma tiek atskaņota
  duration = 0; // Kopējais dziesmas ilgums
  currentTime = 0; // Pašreizējais atskaņošanas laiks

  volume = 1; // Standarta skaļums

  fadeInterval: any = null;

  fadeOut(audio: HTMLAudioElement, callback: () => void) {
    if (this.fadeInterval) clearInterval(this.fadeInterval);

    const step = 0.05; // how much volume decreases each frame
    const speed = 20; // interval in ms
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

  fadeIn(audio: HTMLAudioElement, targetVolume: number) {
    if (this.fadeInterval) clearInterval(this.fadeInterval);

    const step = 0.05;
    const speed = 20;
    audio.volume = 0;

    this.fadeInterval = setInterval(() => {
      if (audio.volume + step < targetVolume) {
        audio.volume += step;
      } else {
        audio.volume = targetVolume;
        clearInterval(this.fadeInterval);
      }
    }, speed);
  }


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

    const storedVolume = localStorage.getItem('playerVolume');
    this.volume = storedVolume ? +storedVolume : 1;


    // Kad tiek mainīta dziesma - ielādē jauno
    this.trackSub = this.playerService.currentTrack$.subscribe(track => {
      if (track) {
        this.currentTrack = track; // Atjauno komponentes lokālo dziesmas stāvokli
        this.playTrack(); // Pārslēdz audio failu atskaņošanai
      }
    });

    // Atskaņošanas statusa maiņa
    this.playbackSub = this.playerService.isPlaying$.subscribe(playing => {
      const audio = this.audioElement.nativeElement;
      this.isPlaying = playing; // Atjauno lokālo mainīgo

      if (playing) {
        if (audio.readyState >= 3) {
          // Pārbaude: ja dziesma ir no sākuma - atskaņot to uzreiz (bez fadein)
          if (Math.floor(audio.currentTime) === 0) {
            audio.volume = this.volume;
            audio.play();
          } else {
            audio.play().then(() => {
              this.fadeIn(audio, this.volume);
            });
          }
        }
      } else {
        this.fadeOut(audio, () => {
          audio.pause();
        });
      }

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

    // Kad ir pieejama informācija par ilgumu
    audio.addEventListener('loadedmetadata', () => {
      this.duration = audio.duration;
    });

    // Laika atjaunošana reālajā laikā
    audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) { // Tikai tad, ja lietotājs nevelk laika joslu
        this.currentTime = audio.currentTime;
        this.playerService.setCurrentTime(audio.currentTime); // Sinhronizē ar servisu
      }
    });

    // Kad dziesma beidzas
    audio.addEventListener('ended', () => {
      this.onEnded();
    });
  }

  // Atbrīvo resursus
  ngOnDestroy() {
    this.trackSub?.unsubscribe(); // Atceļ dziesmas izmaiņu abonementu
    this.playbackSub?.unsubscribe(); // Atceļ atskaņošanas statusa abonementu
    this.timeSub?.unsubscribe(); // Atceļ laika izsekošanas abonementu
  }

  // Atskaņo pašreizējo dziesmu no saglabātā laika
  playTrack() {
    const audio = this.audioElement.nativeElement;
    this.isPlaying = false;

    // Klausas kad audio var tikt atskaņots bez pauzem
    const canPlayHandler = () => {
      const savedTime = this.playerService.getCurrentTime();
      // Ja netiek veikta manuāla laika vilkšana, tad pārlēkt uz saglabāto laiku
      if (!this.isSeeking && savedTime > 0) {
        audio.currentTime = savedTime;
      }
      // Ja statusa ir "spelet", tad uzsakt atskaņošanu
      if (this.playerService.getIsPlaying()) {
        audio.play();
      }

      audio.removeEventListener('canplaythrough', canPlayHandler);
    };

    audio.addEventListener('canplaythrough', canPlayHandler);
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
    const audio = this.audioElement.nativeElement;
    // Ja audio vēl nav pilnībā ielādēts, tad jāgaida 'loadedmetadata'
    if (audio.readyState < 1) {
      const waitForReady = () => {
        audio.currentTime = this.currentTime;
        this.playerService.setCurrentTime(this.currentTime);
        audio.removeEventListener('loadedmetadata', waitForReady);
      };
      audio.addEventListener('loadedmetadata', waitForReady);
    } else { // Ja jau ir gatavs — pārlēkt uz norādīto vietu
      audio.currentTime = this.currentTime;
      this.playerService.setCurrentTime(this.currentTime);
    }

    this.isSeeking = false; // Atslēdz "vilkšanas režīmu"
  }

  // Formatē laiku sekundes uz MM:SS
  formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  // Tiek izsaukts kad dziesma ir beigusies
  onEnded() {
    this.isPlaying = false; // Statuss = beigts
    this.currentTime = 0;
    this.playerService.setCurrentTime(0); // Informē servisu
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
