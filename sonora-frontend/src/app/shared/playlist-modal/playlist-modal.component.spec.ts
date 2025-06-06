import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaylistModalComponent } from './playlist-modal.component';

describe('PlaylistModalComponent', () => {
  let component: PlaylistModalComponent;
  let fixture: ComponentFixture<PlaylistModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaylistModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlaylistModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
