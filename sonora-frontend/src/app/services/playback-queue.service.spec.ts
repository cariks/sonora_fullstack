import { TestBed } from '@angular/core/testing';

import { PlaybackQueueService } from './playback-queue.service';

describe('PlaybackQueueService', () => {
  let service: PlaybackQueueService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlaybackQueueService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
