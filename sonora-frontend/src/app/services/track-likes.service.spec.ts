import { TestBed } from '@angular/core/testing';

import { TrackLikesService } from './track-likes.service';

describe('TrackLikesService', () => {
  let service: TrackLikesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrackLikesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
