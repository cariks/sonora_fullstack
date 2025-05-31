import { Component, Input } from '@angular/core';
import { NgStyle, CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  imports: [
    CommonModule,
    NgStyle
  ],
  templateUrl: './profile-avatar.component.html',
  styleUrl: './profile-avatar.component.scss'
})
export class ProfileAvatarComponent {
  @Input() photoUrl: string | null = null;
  @Input() displayName: string = '';
  @Input() size: number = 40;

  get initials(): string {
    const names = this.displayName.trim().split(' ');
    if (names.length === 0 || !names[0]) return '?';
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[1][0]).toUpperCase();
  }

  ngOnInit() {
    console.log('👤 photoUrl:', this.photoUrl);
  }
}
