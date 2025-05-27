import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-image-sequence',
  templateUrl: './image-sequence.component.html',
  styleUrls: ['./image-sequence.component.scss']
})
export class ImageSequenceComponent implements OnInit, OnChanges {
  @Input() path: string = 'assets/animations/login-animation-compressed';
  @Input() frameCount: number = 59;
  @Input() fps: number = 60;
  @Input() extension: string = 'webp';
  @Input() playOnTrigger: boolean = false;
  @Output() finished = new EventEmitter<void>();

  images: HTMLImageElement[] = [];
  currentFrame: number = 0;
  ready: boolean = false;
  playing = false;

  slideOut = false;

  ngOnInit() {
    this.preloadImages().then(() => {
      this.ready = true;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['playOnTrigger'] && this.playOnTrigger && this.ready && !this.playing) {
      this.playAnimation();
    }
  }

  preloadImages(): Promise<void> {
    const promises = [];
    for (let i = 1; i <= this.frameCount; i++) {
      const img = new Image();
      img.src = `${this.path}/(${i}).${this.extension}`;
      promises.push(new Promise<void>((resolve) => (img.onload = () => resolve())));
      this.images.push(img);
    }
    return Promise.all(promises).then(() => {});
  }

  playAnimation() {
    this.playing = true;
    this.currentFrame = 0;
    const start = performance.now();
    const duration = (this.frameCount / this.fps) * 1000;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = elapsed / duration;
      const frame = Math.floor(progress * this.frameCount);

      if (frame !== this.currentFrame && frame < this.frameCount) {
        this.currentFrame = frame;
      }

      if (frame >= this.frameCount) {
        this.finished.emit();
        this.playing = false;
      } else {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);

    //
    setTimeout(() => {
      this.slideOut = true;
    }, duration * 0.3);
  }


  get currentSrc(): string {
    return this.images[this.currentFrame]?.src || '';
  }
}
