
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'photos' },
  {
    path: 'photos',
    loadComponent: () =>
      import('./pages/photos/photos.page').then(m => m.PhotosPage),
  },
  {
    path: 'map',
    loadComponent: () =>
      import('./pages/map/map.page').then(m => m.MapPage),
  },
  {
    path: 'camera',
    loadComponent: () =>
      import('./pages/camera/camera.page').then(m => m.CameraPage),
  },
  { path: '**', redirectTo: 'photos' },
];
