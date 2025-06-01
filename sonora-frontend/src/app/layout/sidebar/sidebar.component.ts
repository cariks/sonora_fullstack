import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  @Input() collapsed = false;
  @Output() toggle = new EventEmitter<void>();

  navItems = [
    { label: 'Sākums', icon: 'fas fa-home', link: '/' },
    { label: 'Iemīļotas dziesmas', icon: 'fas fa-heart', link: '/playlist/liked' },
    { label: 'Atskaņošanas saraksti', icon: 'fas fa-list', link: '/playlists' },
    { label: 'Augšupielādēt dziesmu', icon: 'fas fa-upload', link: '/upload' },
    { label: 'Manas dziesmas', icon: 'fas fa-music', link: '/my-songs' },

  ];

  ngOnInit() {
    const saved = localStorage.getItem('sidebarCollapsed');
    this.collapsed = saved === 'true';
  }

  emitToggle() {
    this.collapsed = !this.collapsed;
    localStorage.setItem('sidebarCollapsed', this.collapsed.toString());
    this.toggle.emit();
  }
}
