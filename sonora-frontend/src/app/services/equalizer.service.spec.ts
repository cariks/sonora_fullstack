import { TestBed } from '@angular/core/testing';

import { EqualizerService } from './equalizer.service';

describe('EqualizerService', () => {
  let service: EqualizerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EqualizerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
