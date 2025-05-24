import { TestBed } from '@angular/core/testing';

import { StemsMixerService } from './stems-mixer.service';

describe('StemsMixerService', () => {
  let service: StemsMixerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StemsMixerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
