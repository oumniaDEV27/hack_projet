// import { Component, OnInit } from '@angular/core';
// import { IonicModule, AlertController } from '@ionic/angular';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router } from '@angular/router';
// import { PhotoService } from '../../core/photo.service';
// import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// @Component({
//   standalone: true,
//   selector: 'app-photos',
//   templateUrl: './photos.page.html',
//   styleUrls: ['./photos.page.scss'],
//   imports: [IonicModule, CommonModule, FormsModule],
// })
// export class PhotosPage implements OnInit {
//   constructor(
//     public photoService: PhotoService,
//     private alertCtrl: AlertController,
//     private router: Router
//   ) {}

//   async ngOnInit() {
//     await this.photoService.loadSaved();
//   }

//   async takePhoto() {
//     const photo = await Camera.getPhoto({
//       quality: 80,
//       resultType: CameraResultType.DataUrl,
//       source: CameraSource.Camera,   // ou CameraSource.Prompt
//       saveToGallery: false
//     });

//     if (photo?.dataUrl) {
//       await this.photoService.saveFromDataUrl(photo.dataUrl);
//     }
//   }

//   async confirmDelete(i: number) {
//     const alert = await this.alertCtrl.create({
//       header: 'Supprimer cette photo ?',
//       buttons: [
//         { text: 'Annuler', role: 'cancel' },
//         { text: 'Supprimer', role: 'destructive', handler: () => this.photoService.removeAt(i) }
//       ],
//     });
//     await alert.present();
//   }

//   toggleLike(i: number) { this.photoService.toggleLike(i); }

//   /** Ouvre la page carte et centre sur la photo si coordonnées connues */
//   goToMap(i: number) {
//     const p = this.photoService.photos[i];
//     if (p?.coords) {
//       this.router.navigate(['/map'], {
//         queryParams: { lat: p.coords.lat, lng: p.coords.lng, z: 14 }
//       });
//     } else {
//       this.router.navigate(['/map']);
//     }
//   }
// }


import { Component, OnInit } from '@angular/core';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PhotoService } from '../../core/photo.service';

import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  CameraDirection,
} from '@capacitor/camera';

@Component({
  standalone: true,
  selector: 'app-photos',
  templateUrl: './photos.page.html',
  styleUrls: ['./photos.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class PhotosPage implements OnInit {
  /** --- État pour la prévisualisation --- */
  previewOpen = false;
  selectedPhoto: any | undefined;

  constructor(
    public photoService: PhotoService,
    private alertCtrl: AlertController,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
  }

  /** --- Ouvre / ferme la prévisualisation plein écran --- */
  openPreview(p: any) {
    this.selectedPhoto = p;
    this.previewOpen = true;
  }

  closePreview() {
    this.previewOpen = false;
    this.selectedPhoto = undefined;
  }

  /** --- Prend une photo avec la caméra --- */
  async takePhoto() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        // Navigateur : utiliser getUserMedia pour forcer la vraie webcam
        await this.takePhotoWithWebcam(true); // true = front, false = rear
        return;
      }

      // Mobile natif (Android/iOS) : Capacitor Camera
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,       // ouvre directement la caméra
        webUseInput: false,                 // évite le file picker en web
        direction: CameraDirection.Front,   // Front | Rear
        saveToGallery: false,
      });

      if (photo?.dataUrl) {
        await this.photoService.saveFromDataUrl(photo.dataUrl);
      }
    } catch (err) {
      console.error('Erreur capture caméra :', err);
      const alert = await this.alertCtrl.create({
        header: 'Caméra',
        message: 'Impossible d’ouvrir la caméra. Vérifie les permissions.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  /** --- Fallback Web (getUserMedia) --- */
  private async takePhotoWithWebcam(preferFront = true) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    if (!cams.length) throw new Error('Aucune caméra détectée');

    // Heuristique pour choisir front / rear si label dispo
    let chosen = cams[0];
    if (preferFront) {
      chosen = cams.find(d => /front|user/i.test(d.label)) || cams[0];
    } else {
      chosen = cams.find(d => /back|rear|environment/i.test(d.label)) || cams[0];
    }

    const constraints: MediaStreamConstraints = chosen?.deviceId
      ? { video: { deviceId: { exact: chosen.deviceId } }, audio: false }
      : { video: { facingMode: preferFront ? 'user' : 'environment' }, audio: false };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    const video = document.createElement('video');
    (video as any).srcObject = stream;
    video.setAttribute('playsinline', '');
    await video.play();

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    await this.photoService.saveFromDataUrl(dataUrl);

    stream.getTracks().forEach(t => t.stop());
    (video as any).srcObject = null;
  }

  /** --- Supprimer une photo --- */
  async confirmDelete(i: number) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer cette photo ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => this.photoService.removeAt(i) },
      ],
    });
    await alert.present();
  }

  /** --- Aimer / ne pas aimer une photo --- */
  toggleLike(i: number) {
    this.photoService.toggleLike(i);
  }

  /** --- Ouvre la page carte centrée sur la photo --- */
  goToMap(i: number) {
    const p = this.photoService.photos[i];
    if (p?.coords) {
      this.router.navigate(['/map'], {
        queryParams: { lat: p.coords.lat, lng: p.coords.lng, z: 14 },
      });
    } else {
      this.router.navigate(['/map']);
    }
  }
}
