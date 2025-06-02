import { TestBed } from '@angular/core/testing';

import { PlaylistUpdateService } from './playlist-update.service';

describe('PlaylistUpdateService', () => {
  let service: PlaylistUpdateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlaylistUpdateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
