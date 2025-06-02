import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PlaylistService } from '../../services/playlist.service';
import { ReactiveFormsModule } from '@angular/forms';
import {NgClass, NgIf} from "@angular/common";

@Component({
  selector: 'app-playlist-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    NgClass
  ],
  templateUrl: './playlist-modal.component.html',
  styleUrl: './playlist-modal.component.scss'
})
export class PlaylistModalComponent {
  @Output() close = new EventEmitter<void>();

  form: FormGroup;
  photoPreviewUrl: string | null = null;
  selectedFile: File | null = null;
  error: string = '';
  loading = false;

  constructor(private fb: FormBuilder, private playlistService: PlaylistService) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(60)]],
      description: [''],
      is_public: [false]
    });
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.error = 'Tikai PNG vai JPG';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error = 'Failam jābūt mazākam par 10MB';
      return;
    }
    this.selectedFile = file;
    this.error = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async submit() {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const formData = new FormData();
    formData.append('title', this.form.value.title);
    formData.append('description', this.form.value.description);
    formData.append('is_public', this.form.value.is_public ? '1' : '0');
    if (this.selectedFile) {
      formData.append('cover', this.selectedFile);
    }

    try {
      await this.playlistService.createPlaylist(formData).toPromise();
      this.playlistService.loadPlaylists(); // atsvaidzinam sarakstu
    } catch (err) {
      console.error(err);
    } finally {
      this.loading = false;
      this.close.emit();
    }
  }
}
