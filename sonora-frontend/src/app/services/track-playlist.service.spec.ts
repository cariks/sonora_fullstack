import { TestBed } from '@angular/core/testing';

import { TrackPlaylistService } from './track-playlist.service';

describe('TrackPlaylistService', () => {
  let service: TrackPlaylistService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrackPlaylistService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
