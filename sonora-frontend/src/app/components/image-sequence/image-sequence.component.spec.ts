import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageSequenceComponent } from './image-sequence.component';

describe('ImageSequenceComponent', () => {
  let component: ImageSequenceComponent;
  let fixture: ComponentFixture<ImageSequenceComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ImageSequenceComponent]
    });
    fixture = TestBed.createComponent(ImageSequenceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
