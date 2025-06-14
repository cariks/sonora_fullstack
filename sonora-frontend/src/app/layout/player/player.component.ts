// importē nepieciešamos angular elementus un servisus
import {
  Component, ElementRef, EventEmitter, HostListener, Output, ViewChild, ViewChildren, QueryList, ChangeDetectorRef, Input, OnDestroy, OnInit
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { PlayerService } from '../../services/player.service';
import { StemsMixerService } from '../../services/stems-mixer.service';
import { TrackLikesService } from '../../services/track-likes.service';
import { AuthService } from '../../services/auth.service';
import { PlaylistUpdateService } from '../../services/playlist-update.service';
import { debounceTime } from 'rxjs/operators';
import { EqualizerService, UserAudioSettings, EqualizerPreset } from '../../services/equalizer.service';

// komponents, kas atbild par mūzikas atskaņošanu un playera interfeisu
@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent implements OnInit, OnDestroy {
  // bāzes url priekš audio failiem
  private readonly BASE_URL = '/storage/';
  // ielādes bloķēšanas flag - novērš vairākas vienlaicīgas dziesmu ielādes
  private isTrackLoading = false;
  private isTrackBuffered = false;
  isTrackDataLoaded = false;
  isPlayButtonDisabled = true;
  isNavigationDisabled = true;

  showFullLyrics = false;
  parsedLyrics: { time: number, text: string }[] = [];
  isTimestampedLyrics = false;
  activeLyricIndex = -1;


  // EFEKTI, PRESETI UTT
  selectedEffectTab: 'stems' | 'eq' | 'stereo' = 'eq';

  private readonly EFFECTS_TAB_KEY = 'sonora_selected_effects_tab';

  eqEnabled = false;
  eqSettings: number[] = [0, 0, 0, 0, 0, 0];
  eqFrequencies = [60, 150, 400, 1000, 2400, 15000];
  private eqUpdateTimer: any = null;
  private eqFilters: BiquadFilterNode[] = [];
  private masterGainNode!: GainNode;
  private stereoGainNode!: GainNode;
  private stereoMerger!: ChannelMergerNode;
  private stereoChannelSplitter!: ChannelSplitterNode;
  private eqGainNode!: GainNode;
  private compressor!: DynamicsCompressorNode;

  showPresetModal = false;
  newPresetName = '';
  newPresetIcon: string | null = null;
  availableIcons = ['airpods3', 'airpodspro', 'airpods', 'airpodsmax', 'car', 'speaker'];
  userPresets: EqualizerPreset[] = [];
  selectedPresetId: number | null = null;
  selectedPresetIcon: string | null = null;
  isPresetModified = true;

  showPresetDropdown = false;
  presetDropdownTop = 0;
  presetDropdownLeft = 0;

  stereoEnabled = false;
  stereoLevel = 1.0;

  private stereoUpdateTimer: any = null;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Jja tika noklikšķināts uz iepriekš iestatīto iestatījumu pogas vai uznirstošā loga iekšpuse tad to neaizveram
    if (target.closest('.preset-selector') || target.closest('.preset-dropdown')) {
      console.log('Click inside preset elements, keeping dropdown open');
      return;
    }

    if (this.showPresetDropdown) {
      console.log('Click outside preset elements, closing dropdown');
      this.showPresetDropdown = false;
      this.cdr.detectChanges();
    }
  }

  togglePresetDropdown(event: MouseEvent) {
    console.log('Toggling preset dropdown, current state:', this.showPresetDropdown);
    console.log('Conditions:', {
      showEffects: this.showEffects,
      selectedEffectTab: this.selectedEffectTab,
      showPresetDropdown: this.showPresetDropdown
    });

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    // pozicija zem pogas
    this.presetDropdownTop = rect.bottom + 4; // 4px gap
    this.presetDropdownLeft = rect.left;

    this.showPresetDropdown = !this.showPresetDropdown;
    console.log('New state:', this.showPresetDropdown);
    
    this.cdr.detectChanges();
  }

  selectPreset(presetId: number | null) {
    console.log('[EQ] Selecting preset:', presetId);
    
    // meklejam presetu
    const preset = this.userPresets.find(p => p.eq_preset_id === presetId);
    if (!preset && presetId !== null) {
      console.warn('[EQ] Preset not found:', presetId);
      return;
    }

    // athaunojam preset selection
    this.selectedPresetId = presetId;
    this.selectedPresetIcon = preset?.icon ?? null;
    this.isPresetModified = false;

    // Ja ir iepriekš iestatīts presets, piemēro tā iestatījumus
    if (preset) {
      const settings = typeof preset.eq_setting === 'string' 
        ? JSON.parse(preset.eq_setting)
        : preset.eq_setting;

      // atjaunojam
      this.eqSettings = [...settings];
      
      // atjaunojam filtrus ja ir
      this.eqFilters.forEach((filter, index) => {
        if (filter) {
          filter.gain.value = this.eqSettings[index];
        }
      });

      if (!this.eqEnabled) {
        this.eqEnabled = true;
      }

      // atjaunojam kas ir DB
      this.updateUserSettings({
        eq_enabled: true,
        eq_settings: this.eqSettings,
        selected_preset_id: presetId
      });

      // atjaunojam chain
      requestAnimationFrame(() => {
        this.rebuildAudioChain();
      });
    }
  }

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
  showEffects = true;
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
    private equalizerService: EqualizerService,
  ) {
    // ielādē saglabāto skaļumu no localStorage
    const savedVolume = localStorage.getItem('playerVolume');
    if (savedVolume) {
      this.volume = parseFloat(savedVolume);
    }
    this.loadSelectedEffectsTab();
  }

  private loadSelectedEffectsTab() {
    const savedTab = localStorage.getItem(this.EFFECTS_TAB_KEY);
    if (savedTab && ['stems', 'eq', 'stereo'].includes(savedTab)) {
      this.selectedEffectTab = savedTab as 'stems' | 'eq' | 'stereo';
    }
  }

  private saveSelectedEffectsTab(tab: 'stems' | 'eq' | 'stereo') {
    localStorage.setItem(this.EFFECTS_TAB_KEY, tab);
  }

  setEffectsTab(tab: 'stems' | 'eq' | 'stereo') {
    this.selectedEffectTab = tab;
    this.saveSelectedEffectsTab(tab);
  }

  // inicializācija, angular dzīves cikls / subscriptions
  // šī funkcija tiek izsaukta pēc komponenta izveides
  ngOnInit() {
    // audio konteksta un mezglu izveide
    this.audioCtx = new AudioContext();
    this.masterGainNode = this.audioCtx.createGain();
    this.stereoChannelSplitter = this.audioCtx.createChannelSplitter(2);
    this.stereoMerger = this.audioCtx.createChannelMerger(2);
    this.stereoGainNode = this.audioCtx.createGain();
    this.eqGainNode = this.audioCtx.createGain();

    // compressors
    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.value = -6;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // izveidojam audio chain
    this.rebuildAudioChain();

    // ielade lietotaja EQ iestatijumus
    this.equalizerService.getUserSettings().subscribe({
      next: (settings: UserAudioSettings) => {
        console.log('[EQ] Loaded user settings:', settings);
        
        // ja nav iestatijumu, izveidojam jaunus ar noklusetajam vertibam
        if (!settings.eq_settings || (typeof settings.eq_settings === 'string' && settings.eq_settings === '[]')) {
          settings = {
            eq_enabled: false,
            eq_settings: [0, 0, 0, 0, 0, 0],
            selected_preset_id: null,
            stereo_expansion_enabled: false,
            stereo_expansion_level: 0.5
          };
          // saglabajam noklusetos iestatijumus DB
          this.updateUserSettings(settings);
        }

        this.eqEnabled = settings.eq_enabled ?? false;
        this.eqSettings = Array.isArray(settings.eq_settings) 
          ? settings.eq_settings 
          : JSON.parse(settings.eq_settings as string);

        // stereo paplašinātāja iestatījumu ielāde
        this.stereoEnabled = settings.stereo_expansion_enabled ?? false;
        this.stereoLevel = settings.stereo_expansion_level ?? 0.5;

        // piemerojam efektus
        if (this.eqEnabled) {
          this.applyEq();
        }
        this.applyStereoExpansion();

        // ielade presetus un pielieto izveleto
        this.equalizerService.getPresets().subscribe({
          next: (presets: EqualizerPreset[]) => {
            console.log('[EQ] Loaded presets:', presets);
            this.userPresets = presets ?? [];
            
            // ja ir izvelets presets pielietojam to
            if (settings.selected_preset_id) {
              console.log('[EQ] Loading selected preset:', settings.selected_preset_id);
              this.selectedPresetId = settings.selected_preset_id;
              
              const selectedPreset = this.userPresets.find(
                preset => preset.eq_preset_id === settings.selected_preset_id
              );
              
              if (selectedPreset) {
                console.log('[EQ] Found selected preset:', selectedPreset);
                this.selectedPresetIcon = selectedPreset.icon;
                
                // pielietojam preseta iestatijumus
                let presetSettings = selectedPreset.eq_setting;
                if (typeof presetSettings === 'string') {
                  try {
                    presetSettings = JSON.parse(presetSettings);
                  } catch (e) {
                    console.error('[EQ] Neizdevās parsēt eq_setting:', e);
                    presetSettings = [0, 0, 0, 0, 0, 0];
                  }
                }
                
                this.eqSettings = [...presetSettings];
                
                // pielietojam EQ ja tas ir ieslegts
                if (this.eqEnabled) {
                  this.applyEq();
                }
              } else {
                console.warn('[EQ] Selected preset not found:', settings.selected_preset_id);
                this.selectedPresetId = null;
                this.selectedPresetIcon = null;
              }
            }
            
            this.cdr.detectChanges();
          },
          error: (err: Error) => {
            console.error('[EQ] Neizdevās ielādēt presetus:', err);
          }
        });

        if (this.eqEnabled) {
          this.applyEq();
        } else {
          this.disconnectEqFilters();
        }

        this.cdr.detectChanges();
      },
      error: (err: Error) => {
        console.error('[EQ] Neizdevas ieladet EQ iestatijumus no DB:', err);
        // ja neizdevas ieladet, izmantojam noklusetos iestatijumus
        this.eqEnabled = false;
        this.eqSettings = [0, 0, 0, 0, 0, 0];
      }
    });

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

    // konteinera un aktīvās rindas pozīciju iegūšana
    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();

    // aprēķināt ritināšanas pozīciju
    // novietojiam aktīvo rindu konteinera augšpusē ar nelielu atkāpi
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
        
        // ja statusā nav dziesmas atstājam isFirstLoad = true
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
    // Notiram timer
    if (this.eqUpdateTimer) {
      clearTimeout(this.eqUpdateTimer);
    }
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

      // nosaka ilgumu un tipu
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
      gain.connect(this.masterGainNode);

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
  
  
  


  // nosaka audio ilgumu, izmantojot <audio> elementu
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

  // nosaka audio MIME tipu, izmantojot HEAD pieprasījumu
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
        if (!trimmedLine) continue; // izlaist tuksas rindas
        
        console.log('Processing line:', trimmedLine);
        // atjauninata regulara izteiksme precizai laika zimu parsanai
        const match = trimmedLine.match(/^\[(\d{1,2}):(\d{2}\.\d{2})\](.*)$/);
        
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseFloat(match[2]);
          const time = minutes * 60 + seconds;
          const text = match[3].trim();
          
          // pievienot rindu tikai ja taa nav tuksa
          if (text) {
            this.parsedLyrics.push({ time, text });
          }
        } else {
          console.log('Line did not match timestamp format:', trimmedLine);
        }
      }

      // sakartot rindas pec laika uzticamibai
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
  


  
  // ekvalaizera logika
  onEqToggle() {
    // prevent any potential race conditions
    if (this.isToggleBlocked) {
      console.log('[EQ] Toggle blocked, ignoring');
      return;
    }

    this.isToggleBlocked = true;

    // toggle status
    this.eqEnabled = !this.eqEnabled;
    console.log('[EQ] Toggle changed to:', this.eqEnabled);

    // atjaonojam DB
    this.updateUserSettings({
      eq_enabled: this.eqEnabled,
      eq_settings: this.eqSettings,
      selected_preset_id: this.selectedPresetId
    });

    requestAnimationFrame(() => {
      this.rebuildAudioChain();
      setTimeout(() => {
        this.isToggleBlocked = false;
      }, 100);
    });
  }
  
  
  
  applyEq() {
    if (!this.audioCtx) return;

    try {
      // nonemt EQ connection
      this.disconnectEqFilters();
      this.eqGainNode.disconnect();

      if (this.eqEnabled) {
        // izveido EQ filtrus ja tādu nav
        if (this.eqFilters.length === 0) {
          this.eqFilters = this.eqFrequencies.map(freq => {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1;
            return filter;
          });
        }

        // savienot EQ chain
        const source = this.stereoEnabled ? this.stereoMerger : this.masterGainNode;
        source.disconnect();
        source.connect(this.eqGainNode);

        // savieno filtrus
        let previousNode: AudioNode = this.eqGainNode;
        this.eqFilters.forEach((filter, index) => {
          filter.gain.value = this.eqSettings[index];
          previousNode.connect(filter);
          previousNode = filter;
        });

        previousNode.connect(this.compressor);
      } else {
        const source = this.stereoEnabled ? this.stereoMerger : this.masterGainNode;
        source.disconnect();
        source.connect(this.compressor);
      }
    } catch (e) {
      console.warn('EQ pielietošanas kļūda:', e);
    }
  }
  
  

  

  onEqSliderChange(index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const newValue = +input.value;
    
    // atjauno settingu
    this.eqSettings[index] = newValue;

    // atjauno filtru
    if (this.eqFilters[index]) {
      this.eqFilters[index].gain.value = newValue;
    }

    // parabude vai zimantojam presetu
    if (this.selectedPresetId) {
      const activePreset = this.userPresets.find(p => p.eq_preset_id === this.selectedPresetId);
      if (activePreset) {
        const presetSettings = typeof activePreset.eq_setting === 'string'
          ? JSON.parse(activePreset.eq_setting)
          : activePreset.eq_setting;
        
        this.isPresetModified = JSON.stringify(presetSettings) !== JSON.stringify(this.eqSettings);
      }
    }

    // atjano DB
    if (this.eqUpdateTimer) {
      clearTimeout(this.eqUpdateTimer);
    }
    this.eqUpdateTimer = setTimeout(() => {
      this.updateUserSettings({
        eq_settings: this.eqSettings,
        selected_preset_id: this.isPresetModified ? null : this.selectedPresetId
      });
      this.eqUpdateTimer = null;
    }, 500);
  }
  

  resetEq() {
    this.eqSettings = [0, 0, 0, 0, 0, 0];
    
    // pārbauda vai atiestatīšanas stāvoklis atšķiras no pašreizējā iepriekš iestatītā
    if (this.selectedPresetId) {
      const activePreset = this.userPresets.find(p => p.eq_preset_id === this.selectedPresetId);
      if (activePreset) {
        const presetSettings = typeof activePreset.eq_setting === 'string' 
          ? JSON.parse(activePreset.eq_setting) 
          : activePreset.eq_setting;
        this.isPresetModified = JSON.stringify(presetSettings) !== JSON.stringify(this.eqSettings);
      }
    } else {
      this.isPresetModified = false;
    }
    
    // vispirms pielietojam izmainas
    this.applyEq();

    // tad saglabajam DB
    this.updateUserSettings({
      eq_enabled: this.eqEnabled,
      eq_settings: this.eqSettings,
      selected_preset_id: this.selectedPresetId,
      stereo_expansion_enabled: false,
      stereo_expansion_level: 1.0
    });
  }

  disconnectEqFilters() {
    if (!this.audioCtx || !this.masterGainNode) return;

    console.log('[EQ] Atvienojam filtrus');
    
    // atvienojam visus filtrus
    this.eqFilters.forEach(filter => {
      try {
        filter.disconnect();
      } catch (e) {
        console.warn('[EQ] Neizdevas atvienot filtru:', e);
      }
    });
    
    // notiram filtrus masivu
    this.eqFilters = [];
    
    // pievienojam master gain node pie kompresora
    try {
      this.masterGainNode.disconnect();
      this.masterGainNode.connect(this.compressor);
    } catch (e) {
      console.warn('[EQ] Neizdevas atvienot master gain:', e);
    }
  }
  
  openCreatePresetModal() {
    this.newPresetName = '';
    this.newPresetIcon = null;
    this.showPresetModal = true;
  }
  
  closePresetModal() {
    this.showPresetModal = false;
  }
  
  selectPresetIcon(icon: string) {
    this.newPresetIcon = icon;
  }
  
  savePreset() {
    if (!this.newPresetName || !this.newPresetIcon) return;
  
    const preset = {
      name: this.newPresetName,
      icon: this.newPresetIcon,
      eq_setting: this.eqSettings
    };
  
    this.equalizerService.createPreset(preset).subscribe({
      next: (created) => {
        console.log('[EQ] Presets saved:', created);
        this.closePresetModal();
        
        // preset saraksta atjauninasana
        this.equalizerService.getPresets().subscribe({
          next: (presets: EqualizerPreset[]) => {
            console.log('[EQ] Reloaded presets after creation:', presets);
            this.userPresets = presets ?? [];
            
            // meklejam tikai izveidoto presetu
            const newPreset = this.userPresets.find(p => 
              p.name === this.newPresetName && 
              p.icon === this.newPresetIcon
            );
            
            if (newPreset) {
              // iestatm jauno presetu ka aktivo
              this.selectedPresetId = newPreset.eq_preset_id;
              this.selectedPresetIcon = newPreset.icon;
              this.isPresetModified = false;
              
              this.updateUserSettings({
                selected_preset_id: newPreset.eq_preset_id,
                eq_settings: this.eqSettings
              });
            }
            
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('[EQ] Failed to reload presets:', err);
          }
        });
      },
      error: (err) => {
        console.error('[EQ] Failed to save preset:', err);
      }
    });
  }
  
  onPresetChange() {
    console.log('[EQ] Selected preset ID:', this.selectedPresetId);
    console.log('[EQ] Available presets:', this.userPresets);
    
    if (!this.selectedPresetId) {
      this.selectedPresetIcon = null;
      this.isPresetModified = false;

      this.updateUserSettings({
        selected_preset_id: null,
        eq_settings: this.eqSettings
      });
      return;
    }

    const selectedPreset = this.userPresets.find(
      preset => preset.eq_preset_id === Number(this.selectedPresetId)
    );


    if (!selectedPreset) {
      console.error('[EQ] Presets nav atrasts:', this.selectedPresetId, 'Available presets:', this.userPresets);
      this.selectedPresetId = null;
      this.selectedPresetIcon = null;
      return;
    }

    // ja nepieciešams pārveidojam virkni par masīvu
    let presetSettings = selectedPreset.eq_setting;
    if (typeof presetSettings === 'string') {
      try {
        presetSettings = JSON.parse(presetSettings);
      } catch (e) {
        console.error('[EQ] Neizdevās parsēt eq_setting:', e);
        presetSettings = [0, 0, 0, 0, 0, 0]; // fallback
      }
    }

    this.eqSettings = [...presetSettings];
    this.selectedPresetIcon = selectedPreset.icon;
    this.isPresetModified = false;

    this.updateUserSettings({
      selected_preset_id: selectedPreset.eq_preset_id,
      eq_settings: presetSettings
    });

    if (this.eqEnabled) {
      this.applyEq();
    }
  }

  updateCurrentPreset() {
    if (!this.selectedPresetId) return;
  
    this.equalizerService.updatePreset(this.selectedPresetId, {
      eq_setting: this.eqSettings
    }).subscribe({
      next: () => {
        const preset = this.userPresets.find(p => p.eq_preset_id === this.selectedPresetId);
        if (preset) preset.eq_setting = [...this.eqSettings];
        this.isPresetModified = false;
        console.log('[EQ] Presets atjaunots veiksmīgi');

        this.updateUserSettings({
          selected_preset_id: this.selectedPresetId,
          eq_settings: this.eqSettings
        });
      },
      error: (err) => {
        console.error('[EQ] Neizdevās atjaunot presetu:', err);
      }
    });
  }


  // Stereo paplasinatajs

  onStereoToggle(event: Event) {
      // тovērš iespējamus vienlaicīgus izsaukumus
    if (this.isToggleBlocked) {
      console.log('[Stereo] Toggle blocked, ignoring');
      return;
    }

    this.isToggleBlocked = true;

    // pārslēdz stereo paplašinājuma statusu
    this.stereoEnabled = !this.stereoEnabled;
    console.log('[Stereo] Toggle changed to:', this.stereoEnabled);

    // atjauno DB
    this.updateUserSettings({
      stereo_expansion_enabled: this.stereoEnabled,
      stereo_expansion_level: this.stereoLevel
    });

    // pārveido audio ķēdi nākamajā animācijas kadrā
    requestAnimationFrame(() => {
      this.rebuildAudioChain();
      // atslēdz aizsardzību pēc īsa brīža lai izvairītos no pārāk biežas pārslēgšanas
      setTimeout(() => {
        this.isToggleBlocked = false;
      }, 100);
    });
  }

  onStereoLevelChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.stereoLevel = +input.value;
  
    // ja stereo paplašinājums ir ieslēgts piemēro izmaiņas reāli
    if (this.stereoEnabled) {
      const sideGain = this.stereoLevel * 2;
      this.stereoGainNode.gain.value = sideGain - 1;
    }
  
    // aizkavēta (debounce) atjaunināšana datubāzē
    if (this.stereoUpdateTimer) {
      clearTimeout(this.stereoUpdateTimer);
    }
    this.stereoUpdateTimer = setTimeout(() => {
      this.updateUserSettings({
        stereo_expansion_level: this.stereoLevel
      });
      this.stereoUpdateTimer = null;
    }, 500);
  }
  
  resetStereoLevel() {
    console.log('[Stereo] Resetting stereo level to 0.5');
    this.stereoLevel = 0.5; // Atiestata uz standarta stereo
    
    // saglabā jauno līmeni datubāzē
    this.updateUserSettings({
      stereo_expansion_level: 0.5
    });

    // atjauno visu audio ķēdi, lai nodrošinātu pareizu savienojumu
    requestAnimationFrame(() => {
      this.rebuildAudioChain();
    });
  }
  
  applyStereoExpansion() {
    if (!this.audioCtx || !this.masterGainNode) return;
  
    try {
      console.log('[Stereo] Applying expansion with level:', this.stereoLevel);
      
      // atvieno iepriekšējos stereo mezglus
      this.stereoChannelSplitter.disconnect();
      this.stereoMerger.disconnect();
      this.stereoGainNode.disconnect();

      if (this.stereoEnabled) {
        // aprēķina stereo paplašinājuma intensitāti (0–1)
        const width = this.stereoLevel;
        const sideGain = width * 2;

        // atvieno masterGain no iepriekšējās ķēdes
        this.masterGainNode.disconnect();
        
        // savieno masterGain ar stereo sadalītāju
        this.masterGainNode.connect(this.stereoChannelSplitter);

        // novirza kanālus uz stereo apvienotāju (sākotnējie L un R)
        this.stereoChannelSplitter.connect(this.stereoMerger, 0, 0);
        this.stereoChannelSplitter.connect(this.stereoMerger, 1, 1);

        // savieno kanālus uz stereo paplašinātāja mezglut to right
        this.stereoChannelSplitter.connect(this.stereoGainNode, 1, 0); // Right to left
        this.stereoGainNode.gain.value = sideGain - 1;

        // pievieno paplašināto signālu atpakaļ stereo
        this.stereoGainNode.connect(this.stereoMerger, 0, 1); // To right channel
        this.stereoGainNode.connect(this.stereoMerger, 0, 0); // To left channel

        // savieno ar nākamo efektu ķēdē (EQ ja ieslēgts, citādi kompresoru)
        this.stereoMerger.disconnect();
        this.stereoMerger.connect(this.eqEnabled ? this.eqGainNode : this.compressor);

        console.log('[Stereo] Expansion applied successfully');
      } else {
        // ja stereo ir izslēgts, savieno masterGain tieši ar nākamo efektu
        this.masterGainNode.disconnect();
        this.masterGainNode.connect(this.eqEnabled ? this.eqGainNode : this.compressor);
        console.log('[Stereo] Stereo disabled, connecting directly to next effect');
      }
    } catch (e) {
      console.warn('[Stereo] Error applying expansion:', e);
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
    console.log('[Volume] Applying volumes:', {
      isStemsMode: this.isStemsMode,
      hasStems: this.hasStems,
      volume: this.volume
    });
    
    // peimero skalumu uz main track
    const mainGain = this.gainNodes.get('main');
    if (mainGain) {
      const mainVolume = (!this.hasStems || !this.isStemsMode) ? this.volume : 0;
      mainGain.gain.value = mainVolume;
    }

    // piemero volume ja ir stems
    if (this.hasStems) {
      for (const type of ['bass', 'drums', 'melody', 'vocals']) {
        const gain = this.gainNodes.get(type);
        if (!gain) continue;

        const baseVolume = this.stemVolumes[type] ?? 0.5;
        const boosted = Math.max(0, Math.min((baseVolume - 0.5) * 2 + 1.0, 1.5));
        const finalVolume = this.isStemsMode ? boosted * this.volume : 0;
        gain.gain.value = finalVolume;
      }
    }

    // izveidojam audio chain
    this.rebuildAudioChain();
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

  updateUserSettings(data: Partial<UserAudioSettings>) {
    // parliecinamies, ka eq_settings ir masivs un selected_preset_id ir skaitlis
    const settingsToUpdate = {
      ...data,
      eq_settings: Array.isArray(data.eq_settings) ? data.eq_settings : this.eqSettings,
      selected_preset_id: data.selected_preset_id !== undefined ? 
        (typeof data.selected_preset_id === 'string' ? 
          parseInt(data.selected_preset_id, 10) : 
          data.selected_preset_id) : 
        this.selectedPresetId
    };

    console.log('[EQ] Saglabajam iestatijumus:', settingsToUpdate);

    // saglabajam DB
    this.equalizerService.updateUserSettings(settingsToUpdate).subscribe({
      next: (response) => {
        console.log('[EQ] Iestatijumi veiksmigi saglabati DB:', response);
        // atjaunojam UI tikai pec veiksmigas saglabasanas
        this.cdr.detectChanges();
      },
      error: (err: Error) => {
        console.error('[EQ] Neizdevas saglabat iestatijumus DB:', err);
        // ja neizdevas saglabat, atjaunojam UI
        this.cdr.detectChanges();
      }
    });
  }

  deletePreset(presetId: number) {
    console.log('Deleting preset:', presetId);
    if (!confirm('Vai tiešām vēlaties dzēst šo presetu?')) return;

    this.equalizerService.deletePreset(presetId).subscribe({
      next: () => {
        console.log('[EQ] Presets deleted:', presetId);
        
        // ja dzēš pašreiz izvēlēto presetu, atiestata izvēli
        if (this.selectedPresetId === presetId) {
          this.selectedPresetId = null;
          this.selectedPresetIcon = null;
          this.isPresetModified = false;
          
          // saglabā iestatījumus bez preseta
          this.updateUserSettings({
            selected_preset_id: null,
            eq_settings: this.eqSettings
          });
        }
        
        // atjauno presetu sarakstu
        this.equalizerService.getPresets().subscribe({
          next: (presets: EqualizerPreset[]) => {
            console.log('[EQ] Reloaded presets after deletion:', presets);
            this.userPresets = presets ?? [];
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('[EQ] Failed to reload presets:', err);
          }
        });
      },
      error: (err) => {
        console.error('[EQ] Failed to delete preset:', err);
      }
    });
  }

  getSelectedPresetName(): string {
    if (!this.selectedPresetId) return 'Noklusējuma';
    const preset = this.userPresets.find(p => p.eq_preset_id === this.selectedPresetId);
    return preset?.name ?? 'Noklusējuma';
  }

  // inicializē audio apstrādes ķēdi
  private setupAudioProcessingChain() {
    if (!this.audioCtx) return;

    console.log('[Audio Chain] Setting up processing chain:', {
      stereoEnabled: this.stereoEnabled,
      eqEnabled: this.eqEnabled,
      stereoLevel: this.stereoLevel,
      eqSettings: this.eqSettings
    });

    // atvieno visus esošos savienojumus
    this.disconnectAllEffects();

    // pamata ķēde: masterGain -> kompresors -> skaņas karte
    this.masterGainNode.disconnect();
    this.masterGainNode.connect(this.compressor);
    this.compressor.disconnect();
    this.compressor.connect(this.audioCtx.destination);

    // piemēro stereo paplašinājumu, ja ieslēgts
    if (this.stereoEnabled) {
      console.log('[Audio Chain] Applying stereo expansion');
      this.applyStereoExpansion();
    }

    // Piemēro ekvalaizeru, ja ieslēgts
    if (this.eqEnabled) {
      console.log('[Audio Chain] Applying EQ');
      this.applyEq();
    }

  }

  // atvieno visus efektu mezglus
  private disconnectAllEffects() {
    if (!this.audioCtx) return;

    // atvieno visus mezglus
    this.masterGainNode.disconnect();
    this.stereoChannelSplitter.disconnect();
    this.stereoMerger.disconnect();
    this.stereoGainNode.disconnect();
    this.eqGainNode?.disconnect();
    this.compressor.disconnect();

    this.disconnectEqFilters();
  }

  // pārbūvē visu audio efektu ķēdi no jauna
  private rebuildAudioChain() {
    if (!this.audioCtx) {
      console.warn('[Audio Chain] No audio context available');
      return;
    }

    try {
      console.log('[Audio Chain] Rebuilding chain:', {
        stereoEnabled: this.stereoEnabled,
        eqEnabled: this.eqEnabled,
        stereoLevel: this.stereoLevel,
        eqSettings: this.eqSettings,
        selectedPresetId: this.selectedPresetId
      });

      // atvieno visus esošos efektus
      this.disconnectAllEffects();

      // sāk ar master gain
      let currentNode: AudioNode = this.masterGainNode;

      // ja stereo ir ieslēgts, piemēro stereo paplašinājumu
      if (this.stereoEnabled) {
        console.log('[Audio Chain] Adding stereo expansion');
        
        // Sadalīt kanālus un atkal apvienot
        currentNode.disconnect();
        currentNode.connect(this.stereoChannelSplitter);

        this.stereoChannelSplitter.connect(this.stereoMerger, 0, 0);
        this.stereoChannelSplitter.connect(this.stereoMerger, 1, 1);

        const sideGain = this.stereoLevel * 2;
        this.stereoChannelSplitter.connect(this.stereoGainNode, 0, 0);
        this.stereoChannelSplitter.connect(this.stereoGainNode, 1, 0);
        this.stereoGainNode.gain.value = sideGain - 1;

        this.stereoGainNode.connect(this.stereoMerger, 0, 1);
        this.stereoGainNode.connect(this.stereoMerger, 0, 0);

        currentNode = this.stereoMerger;
      }

      // ja ekvalaizers ir ieslēgts, piemēro EQ filtrus
      if (this.eqEnabled) {
        console.log('[Audio Chain] Adding EQ');
        
        currentNode.disconnect();
        currentNode.connect(this.eqGainNode);

        if (this.eqFilters.length === 0) {
          console.log('[Audio Chain] Creating EQ filters');
          this.eqFilters = this.eqFrequencies.map(freq => {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1;
            return filter;
          });
        }

        let previousNode: AudioNode = this.eqGainNode;
        this.eqFilters.forEach((filter, index) => {
          filter.disconnect();
          filter.gain.value = this.eqSettings[index];
          previousNode.connect(filter);
          previousNode = filter;
        });

        currentNode = this.eqFilters[this.eqFilters.length - 1];
      }

      // savieno ar kompresoru un audio izeju
      currentNode.disconnect();
      currentNode.connect(this.compressor);
      this.compressor.disconnect();
      this.compressor.connect(this.audioCtx.destination);

      console.log('[Audio Chain] Chain rebuild complete');
    } catch (error) {
      console.error('[Audio Chain] Error rebuilding chain:', error);
      // mēģinam atkopties, savienojot tieši ar audio izeju
      try {
        this.masterGainNode.disconnect();
        this.masterGainNode.connect(this.audioCtx.destination);
      } catch (e) {
        console.error('[Audio Chain] Recovery failed:', e);
      }
    }
  }
}
