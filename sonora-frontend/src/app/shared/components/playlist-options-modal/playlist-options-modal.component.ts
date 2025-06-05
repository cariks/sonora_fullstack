import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, Renderer2
} from '@angular/core';
import { PlaylistService } from '../../../services/playlist.service';
import {NgClass} from "@angular/common";

@Component({
  selector: 'app-playlist-options-modal',
  standalone: true,
  templateUrl: './playlist-options-modal.component.html',
  imports: [
    NgClass
  ],
  styleUrl: './playlist-options-modal.component.scss'
})
export class PlaylistOptionsModalComponent implements OnInit, OnDestroy {
  @Input() playlistId!: number;
  @Input() playlistType!: string;
  @Input() close!: () => void;

  @Output() onClose = new EventEmitter<void>();
  @Output() edited = new EventEmitter<void>();
  @Output() onDeleted = new EventEmitter<void>();

  @ViewChild('modalWrapper') modalWrapper!: ElementRef;
  private globalClickListener!: () => void;

  constructor(
    private renderer: Renderer2,
    private playlistService: PlaylistService
  ) {}

  ngOnInit(): void {
    this.globalClickListener = this.renderer.listen('document', 'click', (event: MouseEvent) => {
      if (this.modalWrapper && !this.modalWrapper.nativeElement.contains(event.target)) {
        this.onClose.emit();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.globalClickListener) {
      this.globalClickListener();
    }
  }

  editPlaylist() {
    console.log('Edit playlist', this.playlistId);
    this.onClose.emit();
  }

  deletePlaylist() {
    if (this.playlistType !== 'manual') return;


    this.playlistService.deletePlaylist(this.playlistId).subscribe({
      next: () => {
        this.onDeleted.emit();
      },
      error: (err) => {
        console.error('Kļūda dzēšot plejlistu:', err);
        alert('Neizdevās dzēst plejlistu.');
      }
    });
  }

}
