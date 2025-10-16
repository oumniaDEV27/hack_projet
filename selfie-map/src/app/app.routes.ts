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
  {
    path: '',
    loadComponent: () =>
      import('./pages/gallery/gallery.page').then(m => m.GalleryPage),
  },
  { path: '**', redirectTo: '' },
];
