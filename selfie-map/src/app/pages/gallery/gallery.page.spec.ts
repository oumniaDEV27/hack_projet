import { TestBed } from '@angular/core/testing';
import { GalleryPage } from './gallery.page';
import { PhotoService } from '../../core/photo.service';

// Mocks simples
class PhotoServiceMock {
  photos: any[] = [];
  loadSaved = jasmine.createSpy('loadSaved').and.returnValue(Promise.resolve());
  saveFromDataUrl = jasmine.createSpy('saveFromDataUrl').and.callFake(async (d: string) => {
    const p = { filepath: Date.now() + '.jpeg', webviewPath: d, takenAt: new Date().toISOString(), liked: false };
    this.photos.unshift(p);
    return p;
  });
  removeAt = jasmine.createSpy('removeAt').and.callFake(async (i: number) => { this.photos.splice(i, 1); });
  toggleLike = jasmine.createSpy('toggleLike').and.callFake(async (i: number) => {
    this.photos[i].liked = !this.photos[i].liked;
  });
}

// mock basique d’AlertController
const alertCtrlMock = {
  create: () => Promise.resolve({ present: () => Promise.resolve() }),
};

describe('GalleryPage (standalone)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryPage], // standalone component
      providers: [
        { provide: PhotoService, useClass: PhotoServiceMock },
        { provide: (window as any).AlertController ?? 'AlertController', useValue: alertCtrlMock },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GalleryPage);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });
});
