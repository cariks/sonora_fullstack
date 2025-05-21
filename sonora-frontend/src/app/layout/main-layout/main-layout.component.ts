import { Component, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  isSidebarCollapsed = false;
  playerWidth = 384;
  sidebarWidth = 315;

  ngOnInit() {
    const playerStored = localStorage.getItem('playerWidth');
    this.playerWidth = playerStored ? +playerStored : 384;

    const sidebarStored = localStorage.getItem('sidebarCollapsed');
    this.isSidebarCollapsed = sidebarStored === 'true';

    // Если сайдбар скрыт, установить меньшую ширину
    this.sidebarWidth = this.isSidebarCollapsed ? 96 : 315;
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.sidebarWidth = this.isSidebarCollapsed ? 96 : 315;
    localStorage.setItem('sidebarCollapsed', this.isSidebarCollapsed.toString());
  }

  getContentWidth(): string {
    return `calc(100% - ${this.sidebarWidth}px - ${this.playerWidth}px)`;
  }
}
