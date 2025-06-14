// importē nepieciešamos angular elementus un servisus
import {
  Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, ViewChildren, QueryList, ChangeDetectorRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { PlayerService } from '../../services/player.service';
import { StemsMixerService } from '../../services/stems-mixer.service';
import { TrackLikesService } from '../../services/track-likes.service';
import { AuthService } from '../../services/auth.service';
import { PlaylistUpdateService } from '../../services/playlist-update.service';
import { debounceTime } from 'rxjs/operators';

// komponents, kas atbild par mūzikas atskaņošanu un playera interfeisu
@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  // bāzes url priekš audio failiem
  private readonly BASE_URL = '/storage/';
  // ielādes bloķēšanas flag - novērš vairākas vienlaicīgas dziesmu ielādes
  private isTrackLoading = false;
  private isTrackBuffered = false;
  isTrackDataLoaded = false;
  isPlayButtonDisabled = true;
  isNavigationDisabled = true;

  selectedEffectTab: 'stems' | 'eq' | 'stereo' = 'stems';

  showFullLyrics = false;


  eqEnabled = false;
  eqSettings = [0, 0, 0, 0, 0, 0];
  eqFrequencies = [60, 150, 400, 1000, 2400, 15000];
  private eqFilters: BiquadFilterNode[] = [];


  parsedLyrics: { time: number, text: string }[] = [];
  isTimestampedLyrics = false;
  activeLyricIndex = -1;

  // audioRef ir galvenais audio elements
  // stemAudioElements ir kolekcija no visiem stem audio elementiem
  @ViewChild('audioRef') audioElement!: ElementRef<HTMLAudioElement>;
  @ViewChildren('stemAudioRef') stemAudioElements!: QueryList<ElementRef<HTMLAudioElement>>;
  // output ļauj komponentam sūtīt notikumus uz vecākkomponenti
  @Output() widthChanged = new EventEmitter<number>();

  // pašreizējā dziesma un tās dati
  currentTrack: any = null;
  stems: { type: string, url: string }[] = [];
  // atskaņošanas stāvokļa mainīgie
  isPlaying = false;
  isStemsMode = false;
  // skaļuma mainīgie
  volume = 1;
  // katra stem skaļuma vērtības (0-1 diapazonā)
  stemVolumes: { [key: string]: number } = {
    bass: 0.5,
    drums: 0.5,
    melody: 0.5,
    vocals: 0.5
  };
  // flag priekš seek operācijām
  isSeeking = false;
  // flag priekš toggle bloķēšanas
  isToggleBlocked = false;

  // avota informācija (no kā tiek atskaņota dziesma - playlist, album, u.c.)
  sourceType: string | null = null;
  sourceName: string | null = null;
  sourceId: number | null = null;

  // like statusa mainīgie
  // likeStatus var būt 'like', 'dislike' vai null
  likeStatus: 'like' | 'dislike' | null = null;
  private likedUpdateSub!: Subscription;
  private likeStatusSub!: Subscription;

  // web audio api mainīgie
  // audioCtx ir galvenais audio konteksts, kas kontrolē visu audio apstrādi
  private audioCtx!: AudioContext;
  // audioBuffers glabā ielādētos audio buferus
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  // gainNodes kontrolē skaļumu katram audio ceļam
  private gainNodes: Map<string, GainNode> = new Map();
  // sourceNodes kontrolē audio avotus
  private sourceNodes: Map<string, AudioBufferSourceNode> = new Map();
  // laika mainīgie atskaņošanas kontrolei
  private startTime: number = 0;
  private pausedTime: number = 0;

  private isInitialLoad = true;
  isFirstLoad = true;

  // efektu un modālo logu stāvokļa mainīgie
  showEffects = false;
  showModal = false;
  selectedTrackId = 0;

  @ViewChild('lyricsContainer') lyricsContainer!: ElementRef<HTMLDivElement>;

  // atver modālo logu ar konkrētu dziesmas id
  openModal(trackId: number) {
    this.selectedTrackId = trackId;
    this.showModal = true;
  }

  // apstrādā labā klikšķa notikumu uz like pogas
  onRightClickLike(event: MouseEvent) {
    event.preventDefault();
    if (!this.currentTrack) return;

    this.openModal(this.currentTrack.id);
  }

  // aizver modālo logu
  closeModal = () => {
    this.showModal = false;
  };

  // pārslēdz efektu paneli
  toggleEffects() {
    this.showEffects = !this.showEffects;
  }

  // mainīgie priekš mixer iestatījumiem
  private mixerSettingsLoaded = false;
  private trackSub!: Subscription;
  private playbackSub!: Subscription;
  private timeSub!: Subscription;
  private needsSync = false;
  private stemVolumeTimers: { [key: string]: any } = {};
  private mainVolumeTimer: any = null;

  // like funkcijas
  likeTrack() {
    this.setLikeStatus('like');
  }

  dislikeTrack() {
    this.setLikeStatus('dislike');
  }

  // iestata like statusu un sūta uz serveri
  setLikeStatus(status: 'like' | 'dislike') {
    if (!this.currentTrack) return;

    // noņemam nost uz otro kliku ja status jau ir iestatīts, tad noņemam to
    const newStatus = this.likeStatus === status ? null : status;
    this.trackLikesService.setTrackLike(this.currentTrack.id, newStatus).subscribe({
      next: () => {
        this.likeStatus = newStatus;
      },
      error: (err) => {
        console.error('neizdevās saglabāt like statusu:', err);
      }
    });
  }

  // ielādē like statusu no servera
  loadLikeStatus(trackId: number) {
    this.trackLikesService.getUserTrackLike(trackId).subscribe({
      next: (res) => {
        this.likeStatus = res?.like_status || null;
      },
      error: (err) => {
        console.error('kļūda ielādējot like statusu:', err);
      }
    });
  }

  // spēlē iepriekšējo dziesmu no rindas
  playPrevious(): void {
    if (this.isNavigationDisabled) return;
    
    this.isNavigationDisabled = true;
    this.activeLyricIndex = -1; // atiestatīt aktīvās rindas indeksu
    if (this.lyricsContainer) {
      this.lyricsContainer.nativeElement.scrollTop = 0; // uz sakumu
    }
    const prev = this.playerService.getPreviousTrack();
    if (prev) {
      this.playerService.setTrack(prev, true);
    }
  }

  // spēlē nākamo dziesmu no rindas
  playNext(): void {
    if (this.isNavigationDisabled) return;
    
    this.isNavigationDisabled = true;
    this.activeLyricIndex = -1; // atiestatīt aktīvās rindas indeksu
    if (this.lyricsContainer) {
      this.lyricsContainer.nativeElement.scrollTop = 0; // uz sakumu
    }
    const next = this.playerService.getNextTrack();
    if (next) {
      this.playerService.setTrack(next, true);
    }
  }

  // karte ar aktīvajiem fade taimeriem
  private activeFadeTimers: Map<HTMLAudioElement, any> = new Map();

  // izveido skaļuma fade efektu
  // šī funkcija ļauj pakāpeniski mainīt skaļumu, lai izvairītos no klikšķiem
  private fadeVolume(
    element: HTMLAudioElement,
    from: number,
    to: number,
    duration: number = 500
  ) {
    // atceļ esošo taimeri, ja tāds ir
    const existingTimer = this.activeFadeTimers.get(element);
    if (existingTimer) clearInterval(existingTimer);

    // aprēķina fade parametrus
    const steps = 30;
    const stepDuration = duration / steps;
    const delta = (to - from) / steps;

    let current = from;
    let step = 0;

    // izveido jaunu taimeri ar intervālu
    const timer = setInterval(() => {
      step++;
      current += delta;
      // ierobežo skaļumu diapazonā no 0 līdz 1
      element.volume = Math.max(0, Math.min(current, 1));
      if (step >= steps) {
        element.volume = to;
        clearInterval(timer);
        this.activeFadeTimers.delete(element);
      }
    }, stepDuration);

    this.activeFadeTimers.set(element, timer);
  }

  // player izmēru mainīgie
  playerWidth = 642;
  readonly defaultWidth = 642;
  isResizing = false;
  minWidth = 420;
  maxWidth = 850;
  bounceClass = '';
  resizeThrottle = false;

  // flag, kas norāda vai ir pieejami stems
  // stems ir atsevišķi audio ceļi, kas ļauj kontrolēt atsevišķus instrumentus
  hasStems = false;

  // pašreizējā atskaņošanas pozīcija
  currentPosition = 0;

  // konstruktors inicializē servisus un ielādē saglabātos iestatījumus
  constructor(
    private http: HttpClient,
    private playerService: PlayerService,
    private stemsMixerService: StemsMixerService,
    private cdr: ChangeDetectorRef,
    private trackLikesService: TrackLikesService,
    private authService: AuthService,
    private playlistUpdateService: PlaylistUpdateService,
  ) {
    // ielādē saglabāto skaļumu no localStorage
    const savedVolume = localStorage.getItem('playerVolume');
    if (savedVolume) {
      this.volume = parseFloat(savedVolume);
    }
  }

  // inicializācija, angular dzīves cikls / subscriptions
  // šī funkcija tiek izsaukta pēc komponenta izveides
  ngOnInit() {
    // izveido jaunu audio kontekstu
    this.audioCtx = new AudioContext();

    // abonējamies uz like statusa izmaiņām
    this.likeStatusSub = this.playlistUpdateService.likeStatusChanged$.subscribe(() => {
      if (this.currentTrack?.id) {
        this.loadLikeStatus(this.currentTrack.id);
      }
    });

    // abonējamies uz dziesmu maiņām ar debounce
    // debounce novērš pārāk biežu ielādi, ja dziesma mainās ātri
    this.trackSub = this.playerService.currentTrack$.pipe(
      debounceTime(100)
    ).subscribe(track => {
      if (track) {
        this.currentTrack = track;
    
        // tikai ja Nav pirma ielade atlaujam autoplay
        const shouldAutoPlay = !this.isInitialLoad && this.playerService.getIsPlaying();
    
        this.loadTrack(track).then(() => {
          if (shouldAutoPlay) this.playAll();
        });
    
        this.loadLikeStatus(track.id);
      }
    });
    

    // ielādē playback statusu no servera
    this.http.get('/api/playback/status', { withCredentials: true }).subscribe({
      next: (status: any) => {
        this.sourceType = status.source_type ?? null;
        this.sourceName = status.source_name ?? null;
      },
      error: (err) => {
        console.error('neizdevās ielādēt playback statusu:', err);
      }
    });
    
    // abonējamies uz atskaņošanas stāvokļa izmaiņām
    this.playbackSub = this.playerService.isPlaying$.subscribe(isPlaying => {
      this.isPlaying = false;
    });

    // abonējamies uz laika izmaiņām
    this.timeSub = this.playerService.currentTime$.subscribe(time => {
      if (!this.isSeeking) {
        this.currentPosition = time;
      }
    });

    // ielādē stems mixer iestatījumus
    this.stemsMixerService.getMixerSettings().subscribe(settings => {
      this.isStemsMode = settings.is_stems_mode;
      this.stemVolumes = {
        bass: settings.bass_level ?? 0.5,
        drums: settings.drums_level ?? 0.5,
        melody: settings.melody_level ?? 0.5,
        vocals: settings.vocals_level ?? 0.5
      };
    });

    // atjauno atskaņošanas stāvokli
    this.restorePlaybackState();
    
    setTimeout(() => {
      this.isInitialLoad = false;
    });

    setInterval(() => {
      if (this.isPlaying && this.audioCtx.state === 'running' && !this.isSeeking) {
        this.currentPosition = this.audioCtx.currentTime - this.startTime;
        this.updateActiveLyric();
        this.cdr.detectChanges();
      }
    }, 100);
  }

  private updateActiveLyric() {
    if (!this.isTimestampedLyrics || !this.parsedLyrics.length) return;

    // atradam pašreizējo rindu, pamatojoties uz atskaņošanas laiku.
    const currentTime = this.currentPosition;
    let newIndex = this.parsedLyrics.findIndex(line => line.time > currentTime) - 1;
    
    // ja neatradam rindu vai nesasniedz beigas izmantojam pēdējo rindu.
    if (newIndex === -2) {
      newIndex = this.parsedLyrics.length - 1;
    }

    // indeksa atjaunināšana tikai tad ja tas ir mainījies
    if (newIndex !== this.activeLyricIndex) {
      this.activeLyricIndex = newIndex;
      this.scrollToActiveLyric();
      this.cdr.detectChanges();
    }
  }

  private scrollToActiveLyric() {
    if (!this.lyricsContainer || !this.isTimestampedLyrics || this.activeLyricIndex === -1) return;

    const container = this.lyricsContainer.nativeElement;
    const activeLine = container.querySelector('.lyrics-line.active') as HTMLElement;
    
    if (!activeLine) return;

    // Konteinera un aktīvās rindas pozīciju iegūšana
    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();

    // Aprēķināt ritināšanas pozīciju
    // Novietojiam aktīvo rindu konteinera augšpusē ar nelielu atkāpi
    const scrollTop = lineRect.top - containerRect.top - 1 + container.scrollTop;

    // Smooth ritināšana uz pozīciju
    container.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    });
  }

  // atjauno atskaņošanas stāvokli
  // šī funkcija tiek izsaukta, lai atjaunotu atskaņošanu pēc lapas pārlādēšanas
  private restorePlaybackState(): void {
    this.isTrackDataLoaded = false;
    this.isFirstLoad = true;

    // 1. iegūstam statusu
    this.http.get<any>('/api/playback/status', { withCredentials: true }).subscribe({
      next: (status) => {
        console.log('Playback status received:', status);
        const { track_id, current_time, is_playing, source_type, source_name, source_id } = status;
        
        // Ja statusā nav dziesmas atstājam isFirstLoad = true
        if (!track_id) {
          this.currentTrack = null;
          this.isTrackDataLoaded = true;
          this.isFirstLoad = false;
          this.isNavigationDisabled = true;
          return;
        }
        
        this.sourceType = source_type ?? null;
        this.sourceName = source_name ?? null;
        this.sourceId = source_id ?? null;

        // 2. iegūstam rindu
        this.http.get<any[]>('/api/playback/queue', { withCredentials: true }).subscribe({
          next: (queueTracks) => {
            console.log('Queue tracks received:', queueTracks);
            if (!queueTracks.length) {
              this.currentTrack = null;
              this.isTrackDataLoaded = true;
              this.isFirstLoad = false;
              this.isNavigationDisabled = true;
              return;
            }

            const index = queueTracks.findIndex(t => t.id === track_id);
            const startIndex = index >= 0 ? index : 0;

            this.playerService.setSource(source_type, source_name);
            this.playerService.setQueue(queueTracks, startIndex, true); // no auto setTrack
            this.playerService.setCurrentTime(current_time ?? 0);
            this.playerService.setIsPlaying(is_playing ?? false);

            this.playerService.setTrack({ id: track_id }, false);
          },
          error: (err) => {
            console.error('neizdevās ielādēt playback rindu:', err);
            this.isTrackDataLoaded = true;
            this.isNavigationDisabled = true;
          }
        });
      },
      error: (error) => {
        console.error('Error restoring playback state:', error);
        this.isTrackDataLoaded = true;
        this.isNavigationDisabled = true;
      }
    });
  }

  // iztīra abonementus, kad komponents tiek iznīcināts
  ngOnDestroy() {
    this.likeStatusSub?.unsubscribe();
    this.likedUpdateSub?.unsubscribe();
  }

  // dziesmas ielāde un iestatīšana
  // šī ir galvenā funkcija, kas ielādē un sagatavo dziesmu atskaņošanai
  async loadTrack(track: any) {
    console.log('Loading track with data:', track);
    if (this.isTrackLoading) {
      console.log('dziesmas ielāde jau notiek, izlaižam');
      return;
    }

    try {
      this.isTrackLoading = true;
      this.isTrackBuffered = false;
      this.isPlayButtonDisabled = true;
      this.isNavigationDisabled = true;
      this.cdr.detectChanges();

      console.log('ielādējam dziesmu:', track);
      
      if (!track || !track.audio_file) {
        console.error('nederīgi dziesmas dati:', track);
        return;
      }

      // apstājam un notīram pašreizējo atskaņošanu
      this.stopAll();

      // notīram esošos buferus un mezglus
      this.audioBuffers.clear();
      this.gainNodes.clear();
      this.sourceNodes.clear();
      
      // atiestatam stāvokli
      if (track.active_version) {
        const version = track.active_version;
      
        track.audio_file = version.audio_file;
        track.lyrics = version.lyrics;
        track.lyrics_visible = version.lyrics_visible;
        track.bpm = version.bpm;
        track.key = version.key;
      
        // 
        track.stems = (version.stems || []).map((stem: any) => ({
          type: stem.stem_type,
          url: stem.audio_file
        }));
      
        console.log('Extracted stems:', track.stems);
      }

      // Nosaka ilgumu un tipu
      this.getAudioDuration(track.audio_file).then(duration => {
        track.duration = duration;
        console.log('Precīzais ilgums:', duration);
      }).catch(err => {
        console.warn('Neizdevās noteikt ilgumu:', err);
      });

      this.getAudioMimeType(track.audio_file).then(type => {
        track.mimeType = type;
        track.extension = this.getAudioExtension(track.audio_file);
        console.log('Faila paplašinājums:', track.extension);
      });
      
      

      this.currentTrack = track;

      this.stems = (track.stems || []).map((stem: any) => ({
        type: stem.type,
        url: stem.url,
      }));

      this.parseLyrics();


      console.log('Applied stems:', this.stems);

      this.hasStems = this.checkStemsAvailability();
      console.log('hasStems (after assign):', this.hasStems);

      console.log('Lyrics visible:', track.lyrics_visible);
      this.currentPosition = 0;
      
      console.log('sākam ielādēt audio datus...');
      // sākam ielādēt visus failus ar prioritāti atkarībā no režīma
      await this.loadInitialAudioData();
      
      console.log('iestatām audio mezglus...');
      // iestatām audio mezglus
      this.setupAudioNodes();
      
      console.log('piemērojam skaļumus...');
      // piemērojam skaļumus
      this.applyAllVolumes();
      
      // noņemam auto-start pie dziesmas ielādes
      // sākam atskaņošanu tikai ja tieši pieprasīts
      if (this.isPlaying) {
        console.log('sākam atskaņošanu...');
        this.playAll();
      }
      
      // turpinām ielādēt atlikušos datus fonā
      this.loadRemainingData();


      // atjaunojam avota informāciju no backend
      this.http.get('/api/playback/status', { withCredentials: true }).subscribe({
        next: (status: any) => {
          this.sourceType = status.source_type ?? null;
          this.sourceName = status.source_name ?? null;
          this.sourceId = status.source_id ?? null;
          console.log('[source] type:', this.sourceType, '| name:', this.sourceName, '| id:', this.sourceId);
        },
        error: (err) => {
          console.error('neizdevās atjaunināt source informāciju:', err);
        }
      });

      // Pec veiskimgas ielades
      requestAnimationFrame(() => {
        this.cdr.detectChanges();
        this.isTrackDataLoaded = true;
        this.isNavigationDisabled = false;
      });
      
    } catch (error) {
      console.error('kļūda ielādējot dziesmu:', error);
      this.stopAll();
      this.isPlayButtonDisabled = true;
      this.isNavigationDisabled = true;
    } finally {
      this.isTrackLoading = false;
    }
  }

  // ielādē sākotnējos audio datus
  // šī funkcija ielādē pirmos 20% no audio failiem, lai varētu sākt atskaņošanu ātrāk
  private async loadInitialAudioData() {
    console.log('ielādējam sākotnējos audio datus');
    
    if (!this.currentTrack || !this.currentTrack.audio_file) {
      throw new Error('nav pieejami derīgi dziesmas dati');
    }
    
    // izveidojam ielādes solījumus visiem failiem
    const loadingPromises = new Map<string, Promise<AudioBuffer>>();
    
    // pievienojam galveno dziesmu ielādes rindai
    console.log('ielādējam galveno dziesmu:', this.currentTrack.audio_file);
    loadingPromises.set('main', this.fetchAndDecodeAudio(this.currentTrack.audio_file, 1));
    
    // pievienojam stems ielādes rindai ja pieejami
    if (this.hasStems) {
      for (const stem of this.stems) {
        if (!stem.url) {
          console.warn('trūkst url stem failam:', stem);
          continue;
        }
        console.log('ielādējam stem:', stem.type, stem.url);
        loadingPromises.set(stem.type, this.fetchAndDecodeAudio(stem.url, 0.2));
      }
    }

    try {
      // gaidām visu failu ielādi līdz 20%
      const results = await Promise.all(loadingPromises.values());
      
      // saglabājam ielādētos buferus
      let index = 0;
      for (const [type, _] of loadingPromises) {
        this.audioBuffers.set(type, results[index]);
        console.log(`sākotnējie dati ielādēti priekš ${type}`);
        index++;
      }

      // pēc 20 % lejupielādes atbloķējiet pogu
      this.isTrackBuffered = true;
      this.isPlayButtonDisabled = false;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading initial audio data:', error);
      this.isPlayButtonDisabled = true;
    }
  }

  // ielādē atlikušos audio datus
  // šī funkcija ielādē atlikušos 80% no audio failiem fonā
  private async loadRemainingData() {
    console.log('ielādējam atlikušos audio datus');
    
    // izveidojam ielādes solījumus atlikušajiem datiem
    const loadingPromises = new Map<string, Promise<AudioBuffer>>();
    
    // pievienojam galveno dziesmu ielādes rindai
    loadingPromises.set('main', this.fetchAndDecodeAudio(this.currentTrack.audio_file, 1));
    
    // pievienojam stems ielādes rindai ja pieejami
    if (this.hasStems) {
      for (const stem of this.stems) {
        loadingPromises.set(stem.type, this.fetchAndDecodeAudio(stem.url, 1));
      }
    }

    // ielādējam atlikušos datus fonā
    const results = await Promise.all(loadingPromises.values());
    
    // atjauninām buferus ar pilniem datiem
    let index = 0;
    for (const [type, _] of loadingPromises) {
      this.audioBuffers.set(type, results[index]);
      console.log(`pilnie dati ielādēti priekš ${type}`);
      index++;
    }
  }

  // atjaunināts fetchAndDecodeAudio lai pieņemtu mērķa procentuālo daudzumu
  // šī funkcija lejupielādē un dekodē audio failus
  private async fetchAndDecodeAudio(url: string, targetPercentage: number = 1): Promise<AudioBuffer> {
    if (!url) {
      throw new Error('nederīgs audio url');
    }

    // pievienojam bāzes url ja url ir relatīvs
    const fullUrl = url.startsWith('http') ? url : `${this.BASE_URL}${url}`;
    console.log('iegūstam audio no:', fullUrl);
    
    try {
      const response = await fetch(fullUrl, {
        credentials: 'include' // pievienojam credentials lai iekļautu cookies
      });
      
      if (!response.ok) {
        throw new Error(`neizdevās iegūt audio: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const contentLength = +response.headers.get('Content-Length')!;

      if (!reader) {
        throw new Error('neizdevās iegūt reader no response');
      }

      // izveidojam buferi audio datu glabāšanai
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      while(true) {
        const {done, value} = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        receivedLength += value.length;

        // ja mums ir pietiekami daudz datu lai sāktu atskaņošanu
        if (receivedLength > contentLength * targetPercentage) {
          // izveidojam buferi no pašreizējiem chunkiem
          const audioData = new Uint8Array(receivedLength);
          let position = 0;
          for (const chunk of chunks) {
            audioData.set(chunk, position);
            position += chunk.length;
          }

          // dekodējam daļējos audio datus
          try {
            const audioBuffer = await this.audioCtx.decodeAudioData(audioData.buffer);
            console.log(`veiksmīgi dekodēti ${targetPercentage * 100}% audio datu`);
            return audioBuffer;
          } catch (error) {
            console.warn('neizdevās dekodēt daļējos audio datus, turpinām lejupielādi');
          }
        }
      }

      // ja neizdevās dekodēt daļējos datus, dekodējam pilno failu
      const audioData = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, position);
        position += chunk.length;
      }

      return await this.audioCtx.decodeAudioData(audioData.buffer);
    } catch (error) {
      console.error('kļūda iegūstot audio:', error);
      throw error;
    }
  }

  // iestatām audio mezglus
  // šī funkcija izveido nepieciešamos audio mezglus katram audio ceļam
  private setupAudioNodes() {
    console.log('iestatām audio mezglus');
    // notīram esošos mezglus
    this.gainNodes.clear();
    this.sourceNodes.clear();

    // izveidojam mezglus katram audio buferim
    for (const [type, buffer] of this.audioBuffers.entries()) {
      console.log('izveidojam mezglus priekš:', type);
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;

      const gain = this.audioCtx.createGain();
      source.connect(gain);
      gain.connect(this.audioCtx.destination);

      this.sourceNodes.set(type, source);
      this.gainNodes.set(type, gain);
      
      console.log('izveidoti mezgli priekš:', type, {
        source: source,
        gain: gain,
        bufferDuration: buffer.duration
      });
    }
  }

  // atskaņošanas kontrole
  // šī funkcija sāk atskaņošanu visiem audio ceļiem
  playAll() {
    console.log('sākam atskaņošanu');
    if (this.audioCtx.state === 'suspended') {
      console.log('atsākam audio kontekstu');
      this.audioCtx.resume();
    }

    // izveidojam jaunus source mezglus visām dziesmām
    this.setupAudioNodes();
    
    // piemērojam pareizos skaļumus atkarībā no pašreizējā režīma
    this.applyAllVolumes();

    const now = this.audioCtx.currentTime;
    this.startTime = now - this.currentPosition;
    this.pausedTime = 0;

    for (const [type, source] of this.sourceNodes.entries()) {
      console.log('sākam source priekš:', type);
      try {
        // iestatām offset lai atsāktu no pareizās pozīcijas
        source.start(now, this.currentPosition);
        console.log('veiksmīgi sākts:', type, 'pozīcijā:', this.currentPosition);
      } catch (error) {
        console.error('kļūda sākot source priekš:', type, error);
      }
    }

    this.isPlaying = true;
  }

  // pauzē atskaņošanu
  pauseAll() {
    // saglabājam pašreizējo pozīciju pirms apstāšanas
    this.currentPosition = this.audioCtx.currentTime - this.startTime;
    console.log('pauzējam pozīcijā:', this.currentPosition);
    
    for (const source of this.sourceNodes.values()) {
      try {
        source.stop();
      } catch (_) {}
    }

    this.isPlaying = false;
  }

  // pilnībā apstāj atskaņošanu
  stopAll() {
    for (const source of this.sourceNodes.values()) {
      try {
        source.stop();
      } catch (_) {}
    }
  
    this.sourceNodes.clear();
    this.gainNodes.clear();
  
    this.isPlaying = false;
    this.startTime = 0;
    this.pausedTime = 0;
    this.currentPosition = 0;
  }

  // pārslēdz atskaņošanas stāvokli
  togglePlay() {
    if (this.isPlayButtonDisabled || !this.currentTrack) {
      return;
    }

    if (this.isPlaying) {
      this.pauseAll();
    } else {
      this.playAll();
    }
  }

  // skaļums un režīmi
  // iestata galveno skaļumu
  setVolume(value: number) {
    this.volume = value;
    
    // piemērojam visiem gain mezgliem
    for (const [type, gain] of this.gainNodes.entries()) {
      if (type === 'main') {
        // vienmēr piemērojam skaļumu galvenajai dziesmai ja stems nav pieejami
        gain.gain.value = (!this.hasStems || !this.isStemsMode) ? value : 0;
      } else {
        gain.gain.value = this.calculateStemVolume(type);
      }
    }
  }

  // kad tiek ievadīts jauns skaļuma līmenis
  onVolumeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.setVolume(+input.value);
  }

  // kad tiek pabeigta skaļuma izmaiņa
  onVolumeCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = +input.value;

    this.volume = value;
    this.applyAllVolumes();

    // atceļ iepriekšējo taimeri, ja ir
    if (this.mainVolumeTimer) {
      clearTimeout(this.mainVolumeTimer);
    }

    // saglabā vērtību pēc 400ms, ja nav citu izmaiņu
    this.mainVolumeTimer = setTimeout(() => {
      localStorage.setItem('playerVolume', value.toString());
      this.mainVolumeTimer = null;
    }, 400);
  }

  // adaptēts onStemsToggle priekš web audio api un 5 audio ceļiem
  // pārslēdz starp normālo un stems režīmu
  onStemsToggle(event: Event) {
    if (!this.currentTrack) return;
    
    const input = event.target as HTMLInputElement;
    const newMode = input.checked;

    this.isStemsMode = newMode;
    
    this.stemsMixerService.updateMixerSettings({ is_stems_mode: newMode }).subscribe({
      next: () => {
        this.applyAllVolumes();
      },
      error: (err) => {
        console.error('neizdevās saglabāt režīmu:', err);
      }
    });
  }

  // aprēķina stem skaļumu ar boosting
  private calculateStemVolume(type: string): number {
    const baseVolume = this.stemVolumes[type] ?? 0.5;
    const boosted = Math.max(0, Math.min((baseVolume - 0.5) * 2 + 1.0, 1.5));
    return this.isStemsMode ? boosted * this.volume : 0;
  }

  // piemēro skaļumu konkrētam stem
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

  // atjaunina katras stems reālo skaļumu
  private updateStemsEffectiveVolume(): void {
    if (!this.stemAudioElements || this.stemAudioElements.length === 0) return;

    this.stemAudioElements.forEach(ref => {
      const el = ref.nativeElement;
      const type = el.dataset['type']?.trim();

      if (!type) {
        console.warn('stem audio trūkst data-type:', el);
        return;
      }

      const baseVolume = this.stemVolumes[type] ?? 0.5;
      const boosted = Math.max(0, Math.min((baseVolume - 0.5) * 2 + 1.0, 1.5));
      let effectiveVolume = this.isStemsMode ? boosted * this.volume : 0;

      effectiveVolume = Math.max(0, Math.min(effectiveVolume, 1));

      el.volume = effectiveVolume;
    });

    if (this.audioElement?.nativeElement) {
      this.audioElement.nativeElement.volume = this.isStemsMode ? 0 : Math.max(0, Math.min(this.volume, 1));
    }
  }

  // atiestata visus stem skaļumus uz noklusējuma vērtībām
  resetStemVolumes(): void {
    // atjauno katra ceļa vērtību lokāli uz 0.5
    for (const type of Object.keys(this.stemVolumes)) {
      this.stemVolumes[type] = 0.5;
      
      // tūlīt piemēro skaļuma izmaiņu web audio api
      const gain = this.gainNodes.get(type);
      if (gain) {
        const boosted = Math.max(0, Math.min((0.5 - 0.5) * 2 + 1.0, 1.5));
        const finalVolume = this.isStemsMode ? boosted * this.volume : 0;
        gain.gain.value = finalVolume;
        console.log('atiestatīts skaļums priekš:', type, 'uz:', finalVolume);
      }
    }

    // saglabā izmaiņas db (visi ceļi vienā pieprasījumā)
    this.stemsMixerService.updateMixerSettings({
      bass_level: 0.5,
      drums_level: 0.5,
      melody_level: 0.5,
      vocals_level: 0.5
    }).subscribe({
      next: () => {
        console.log('stems skaļumi veiksmīgi atiestatīti uz servera');
      },
      error: (err) => {
        console.error('neizdevās saglabāt skaļumu iestatījumus:', err);
      }
    });
  }

  // piemēro galīgos skaļuma iestatījumus
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

  // stem skaļuma kontrole
  // apstrādā stem skaļuma izmaiņas
  onStemVolumeInput(type: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    
    console.log('stem skaļuma ievade:', type, value);
    
    // atjauno lokālo skaļuma vērtību
    this.stemVolumes[type] = value;
    
    // tūlīt piemēro skaļuma izmaiņu web audio api
    const gain = this.gainNodes.get(type);
    if (gain) {
      const boosted = Math.max(0, Math.min((value - 0.5) * 2 + 1.0, 1.5));
      const finalVolume = this.isStemsMode ? boosted * this.volume : 0;
      gain.gain.value = finalVolume;
      console.log('piemērots skaļums gain mezglam:', {
        type,
        value,
        boosted,
        finalVolume,
        isStemsMode: this.isStemsMode
      });
    } else {
      console.warn('nav atrasts gain mezgls priekš:', type);
    }

    // debounce saglabāšanu db
    if (this.stemVolumeTimers[type]) {
      clearTimeout(this.stemVolumeTimers[type]);
    }

    this.stemVolumeTimers[type] = setTimeout(() => {
      console.log(`[db] saglabājam ${type} skaļumu: ${value}`);
      this.stemsMixerService.updateMixerSettings({ [`${type}_level`]: value }).subscribe();
      delete this.stemVolumeTimers[type];
    }, 400);
  }

  seekTo(position: number) {
    if (!this.currentTrack || !this.audioCtx || !this.audioBuffers.size) return;
  
    this.pauseAll();
  
    this.currentPosition = position;
    this.startTime = this.audioCtx.currentTime - this.currentPosition;
  
    // taisam jaunas source nodes
    this.setupAudioNodes();
    this.applyAllVolumes();
  
    for (const [type, source] of this.sourceNodes.entries()) {
      try {
        source.start(this.audioCtx.currentTime, this.currentPosition);
        console.log(`[seek] started ${type} at ${this.currentPosition}`);
      } catch (err) {
        console.warn(`[seek] error starting ${type}`, err);
      }
    }
  
    this.isPlaying = true;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  
  getTrackDuration(): number {
    const mainBuffer = this.audioBuffers.get('main');
    return mainBuffer ? mainBuffer.duration : 0;
  }
  
  onSeekInput(event: Event) {
    this.isSeeking = true;
    const input = event.target as HTMLInputElement;
    this.currentPosition = parseFloat(input.value);
  }
  
  onSeekCommit(event: Event) {
    const input = event.target as HTMLInputElement;
    const newPosition = parseFloat(input.value);
  
    const wasPlaying = this.isPlaying;
  
    this.pauseAll();
    this.currentPosition = newPosition;
  
    if (wasPlaying) {
      this.setupAudioNodes();
      this.applyAllVolumes();
  
      for (const [type, source] of this.sourceNodes.entries()) {
        try {
          source.start(this.audioCtx.currentTime, this.currentPosition);
        } catch (err) {
          console.warn(`[seek] error starting ${type}`, err);
        }
      }
  
      this.startTime = this.audioCtx.currentTime - this.currentPosition;
      this.isPlaying = true;
    } else {
      this.pausedTime = this.currentPosition;
    }
  
    this.isSeeking = false;
  }
  
  
  


  // Nosaka audio ilgumu, izmantojot <audio> elementu
  getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = url.startsWith('http') ? url : `${this.BASE_URL}${url}`;
      audio.preload = 'metadata';

      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });

      audio.addEventListener('error', () => {
        reject('Kļūda ielādējot metadata: ' + url);
      });
    });
  }

  // Nosaka audio MIME tipu, izmantojot HEAD pieprasījumu
  async getAudioMimeType(url: string): Promise<string | null> {
    const fullUrl = url.startsWith('http') ? url : `${this.BASE_URL}${url}`;

    try {
      const response = await fetch(fullUrl, {
        method: 'HEAD',
        credentials: 'include'
      });

      if (!response.ok) throw new Error(`Kļūda: ${response.status}`);
      return response.headers.get('Content-Type');
    } catch (error) {
      console.error('Neizdevās noteikt MIME tipu:', error);
      return null;
    }
  }

  getAudioExtension(url: string): string | null {
    const fullUrl = url.startsWith('http') ? url : `${this.BASE_URL}${url}`;
    const match = fullUrl.match(/\.(mp3|wav|flac)(\?.*)?$/i);
    return match ? match[1].toLowerCase() : null;
  }


  parseLyrics() {
    const raw = this.currentTrack?.lyrics || '';
    console.log('Raw lyrics data:', {
      hasLyrics: !!raw,
      rawLength: raw.length,
      firstChars: raw.substring(0, 100),
      fullRaw: raw
    });
    
    // Normalize line breaks and remove extra spaces
    const normalizedRaw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedRaw.trim().split('\n');
    
    console.log('Split lines:', {
      totalLines: lines.length,
      firstLine: lines[0],
      secondLine: lines[1]
    });
  
    this.parsedLyrics = [];
    this.activeLyricIndex = -1;
  
    if (lines[0]?.trim() === '[timestamped]') {
      console.log('Detected timestamped lyrics format');
      this.isTimestampedLyrics = true;
  
      for (const line of lines.slice(1)) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue; // Izlaist tuksas rindas
        
        console.log('Processing line:', trimmedLine);
        // Atjauninata regulara izteiksme precizai laika zimu parsanai
        const match = trimmedLine.match(/^\[(\d{1,2}):(\d{2}\.\d{2})\](.*)$/);
        
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseFloat(match[2]);
          const time = minutes * 60 + seconds;
          const text = match[3].trim();
          
          console.log('Matched line:', {
            minutes,
            seconds,
            time,
            text,
            match: match[0]
          });
          
          // Pievienot rindu tikai ja taa nav tuksa
          if (text) {
            this.parsedLyrics.push({ time, text });
          }
        } else {
          console.log('Line did not match timestamp format:', trimmedLine);
        }
      }

      // Sakartot rindas pec laika uzticamibai
      this.parsedLyrics.sort((a, b) => a.time - b.time);
      
      console.log('Final parsed lyrics:', {
        totalLines: this.parsedLyrics.length,
        firstFewLines: this.parsedLyrics.slice(0, 3)
      });
    } else {
      console.log('Not timestamped lyrics format, first line:', lines[0]);
      this.isTimestampedLyrics = false;
    }
  }
  


  
  // Ekvalaizera logika
  onEqToggle() {
    this.eqEnabled = !this.eqEnabled;
    console.log('[EQ] Toggle:', this.eqEnabled);
    if (this.eqEnabled) {
      this.applyEq();
    } else {
      this.disconnectEqFilters();
    }
  }
  
  applyEq() {
    if (!this.currentTrack || !this.audioCtx) {
      this.disconnectEqFilters();
      return;
    }

    this.disconnectEqFilters();

    if (!this.eqEnabled) return;

    console.log('[EQ] Applying EQ settings:', this.eqSettings);

    this.eqFilters = this.eqFrequencies.map((freq, index) => {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.0;
      filter.gain.value = this.eqSettings[index];
      console.log(`[EQ] Created filter – freq: ${freq}Hz, gain: ${filter.gain.value}`);
      return filter;
    });

    const buffer = this.audioBuffers.get('main');
    const gain = this.gainNodes.get('main');

    if (!buffer || !gain) {
      console.warn('[EQ] No buffer or gain node found for main track');
      return;
    }

    // Izveidot jaunu avotu
    const newSource = this.audioCtx.createBufferSource();
    newSource.buffer = buffer;

    // Pievienot ekvalaizera filtrus
    let lastNode: AudioNode = newSource;
    this.eqFilters.forEach(filter => {
      lastNode.connect(filter);
      lastNode = filter;
    });
    lastNode.connect(gain);

    // Sakt atskaņot no pašreizējās pozīcijas
    try {
      newSource.start(0, this.currentPosition);
      console.log('[EQ] Started new source with filters at position:', this.currentPosition);
      this.sourceNodes.set('main', newSource);
    } catch (err) {
      console.error('[EQ] Failed to start new source:', err);
    }
  }

  

  onEqSliderChange(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    console.log(`[EQ] Slider changed – index: ${index}, value: ${value}`);
    this.eqSettings[index] = value;
    this.applyEq();
  }

  resetEq() {
    this.eqSettings = [0, 0, 0, 0, 0, 0];
    this.applyEq();
  }

  disconnectEqFilters() {
    // Visu filtru izslēgšana
    this.eqFilters.forEach(filter => {
      try {
        filter.disconnect();
      } catch (_) {}
    });
    this.eqFilters = [];

    // Atjaunot tiešā savienojuma avotu -> ieguvums
    const source = this.sourceNodes.get('main');
    const gain = this.gainNodes.get('main');

    if (source && gain) {
      try {
        source.disconnect();
        source.connect(gain);
      } catch (_) {}
    }
  }
  

  
  




  // resize loģika
  // sāk resize operāciju
  onResizeStart(event: MouseEvent) {
    this.isResizing = true;
    event.preventDefault();
    document.body.classList.add('no-transition');
  }

  // apstrādā resize kustību
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

  // beidz resize operāciju
  @HostListener('document:mouseup')
  onResizeEnd() {
    this.isResizing = false;
    document.body.classList.remove('no-transition');
  }

  // atiestata platumu uz noklusējuma vērtību
  onResizeReset() {
    this.playerWidth = this.defaultWidth;
    localStorage.setItem('playerWidth', this.defaultWidth.toString());
    this.emitWidth();
    this.bounceClass = 'bounce';
    setTimeout(() => this.bounceClass = '', 400);
  }

  // atskaņošana ar space taustiņu
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement).tagName.toLowerCase();
    const isTextInput = tag === 'input' || tag === 'textarea';
    if (event.code === 'Space' && !isTextInput) {
      event.preventDefault();
      this.togglePlay();
    }
  }

  // emitē player platumu uz vecākkomponenti
  emitWidth() {
    this.widthChanged.emit(this.playerWidth);
  }

  // piemēro visus skaļumus
  // šī funkcija nodrošina, ka visi audio ceļi ir iestatīti ar pareizajiem skaļumiem
  private applyAllVolumes() {
    console.log('piemērojam skaļumus, stems režīms:', this.isStemsMode, 'hasStems:', this.hasStems);
    
    // galvenās dziesmas skaļums - vienmēr atskaņo normālajā režīmā ja stems nav pieejami
    const mainGain = this.gainNodes.get('main');
    if (mainGain) {
      // ja stems nav pieejami, vienmēr atskaņo galveno dziesmu neatkarīgi no režīma
      const mainVolume = (!this.hasStems || !this.isStemsMode) ? this.volume : 0;
      mainGain.gain.value = mainVolume;
      console.log('galvenās dziesmas skaļums iestatīts uz:', mainVolume);
    }

    // stem skaļumi ar pareizu boosting - piemēro tikai ja stems ir pieejami
    if (this.hasStems) {
      for (const type of ['bass', 'drums', 'melody', 'vocals']) {
        const gain = this.gainNodes.get(type);
        if (!gain) {
          console.log('nav atrasts gain mezgls priekš:', type);
          continue;
        }

        const baseVolume = this.stemVolumes[type] ?? 0.5;
        const boosted = Math.max(0, Math.min((baseVolume - 0.5) * 2 + 1.0, 1.5));
        const finalVolume = this.isStemsMode ? boosted * this.volume : 0;
        gain.gain.value = finalVolume;
        
        console.log('stem skaļums priekš', type, ':', {
          baseVolume,
          boosted,
          finalVolume,
          isStemsMode: this.isStemsMode
        });
      }
    } else {
      // ja stems nav pieejami, nodrošina ka visi stem gain ir iestatīti uz 0
      for (const type of ['bass', 'drums', 'melody', 'vocals']) {
        const gain = this.gainNodes.get(type);
        if (gain) {
          gain.gain.value = 0;
          console.log('iestatīts stem skaļums uz 0 priekš:', type, '(stems nav pieejami)');
        }
      }
    }
  }

  // pievieno metodi stems pieejamības pārbaudei
  // pārbauda vai visi nepieciešamie stems ir pieejami
  private checkStemsAvailability(): boolean {
    if (!this.stems || this.stems.length === 0) return false;
  
    const required = ['bass', 'drums', 'melody', 'vocals'];
    const present = this.stems.map(s => s.type);
    const allPresent = required.every(type => present.includes(type));
  
    console.log('Stems present:', present, '| All required:', allPresent);
  
    return allPresent;
  }

  // Add this method to get the source URL
  getSourceUrl(): string | null {
    if (!this.sourceType || !this.sourceId) return null;
    
    switch (this.sourceType) {
      case 'playlist':
        return `/playlist/${this.sourceId}`;
      case 'album':
        return `/album/${this.sourceId}`;
      default:
        return null;
    }
  }
}
