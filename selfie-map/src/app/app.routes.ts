// src/app/app.routes.ts
// import { Routes } from '@angular/router';

// export const routes: Routes = [
//   {
//     path: '',
//     loadComponent: () =>
//       import('./pages/gallery/gallery.page').then(m => m.GalleryPage),
//   },
//   { path: 'gallery', redirectTo: '', pathMatch: 'full' },
//   { path: '**', redirectTo: '' },
// ];


// // src/app/app.routes.ts
// import { Routes } from '@angular/router';
// import { GalleryPage } from './pages/gallery/gallery.page';

// export const routes: Routes = [
//   { path: '', component: GalleryPage },
//   { path: '**', redirectTo: '' },
// ];



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
