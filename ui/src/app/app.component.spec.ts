import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app.component';
import { RadarApi } from './radar.api';
import { describe, expect, it } from 'vitest';

describe('AppComponent', () => {
  it('stores a maintainer signature in the tab', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), RadarApi],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    comp.sig = 'Bearer abc';
    comp.save();
    expect(TestBed.inject(RadarApi).signature()).toBe('Bearer abc');
    comp.sig = '  ';
    comp.save();
    expect(TestBed.inject(RadarApi).toast()).toContain('cleared');
  });

  it('shows a toast when set', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient(), RadarApi],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    TestBed.inject(RadarApi).toast.set('hello');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('hello');
  });
});
