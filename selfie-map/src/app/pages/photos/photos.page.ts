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


  openPreview(p: any) {
    this.selectedPhoto = p;
    this.previewOpen = true;
  }

  closePreview() {
    this.previewOpen = false;
    this.selectedPhoto = undefined;
  }


  async takePhoto() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        await this.takePhotoWithWebcam(true); 
        return;
      }


      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,    
        webUseInput: false,                
        direction: CameraDirection.Front,   
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


  private async takePhotoWithWebcam(preferFront = true) {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    if (!cams.length) throw new Error('Aucune caméra détectée');


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


  toggleLike(i: number) {
    this.photoService.toggleLike(i);
  }


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
