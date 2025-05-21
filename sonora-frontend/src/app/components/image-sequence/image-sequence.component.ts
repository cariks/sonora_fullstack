import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-image-sequence',
  templateUrl: './image-sequence.component.html',
  styleUrls: ['./image-sequence.component.scss']
})
export class ImageSequenceComponent implements OnInit {
  @Input() path: string = 'assets/animations/loop1';
  @Input() frameCount: number = 31;
  @Input() fps: number = 25;
  @Input() extension: string = 'webp';

  images: HTMLImageElement[] = [];
  currentFrame: number = 0;
  ready: boolean = false;

  ngOnInit() {
    this.preloadImages().then(() => {
      this.ready = true;
      this.startAnimation();
    });
  }

  preloadImages(): Promise<void> {
    const promises = [];
    for (let i = 1; i <= this.frameCount; i++) {
      const padded = String(i).padStart(5, '0');
      const img = new Image();
      img.src = `${this.path}/${padded}.${this.extension}`;
      promises.push(
        new Promise<void>((resolve) => {
          img.onload = () => resolve();
        })
      );
      this.images.push(img);
    }
    return Promise.all(promises).then(() => {});
  }

  startAnimation() {
    setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
    }, 1000 / this.fps);
  }

  get currentSrc(): string {
    return this.images[this.currentFrame]?.src || '';
  }
}
