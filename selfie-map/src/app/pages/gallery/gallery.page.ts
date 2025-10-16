import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { PhotoService } from '../../core/photo.service';

@Component({
  standalone: true,
  selector: 'app-gallery',
  templateUrl: './gallery.page.html',
  // styleUrls: ['./gallery.page.scss'], // décommenter quand ton SCSS est OK
  imports: [IonicModule, CommonModule],
})
export class GalleryPage implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  streaming = false;
  private stream?: MediaStream;

  constructor(
    public photoService: PhotoService,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  /** Ouvre un flux vidéo, soit sur un deviceId précis, soit "any" */
  private async openStream(deviceId?: string) {
    const constraints: MediaStreamConstraints = deviceId
      ? { video: { deviceId: { exact: deviceId } }, audio: false }
      : { video: true, audio: false };

    // coupe l'ancien flux si présent
    this.stream?.getTracks().forEach(t => t.stop());
    console.log('Tentative ouverture flux avec contraintes:', constraints);
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    const video = this.videoRef.nativeElement;
    // nettoie puis assigne
    try { (video as any).srcObject = null; } catch {}
    (video as any).srcObject = this.stream;

    // s'assure des attributs autoplay compatibles mobile
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    await video.play();
    this.streaming = true;
  }

  // ✅ Version robuste : sélection explicite d’une caméra + fallback
  async startCamera() {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      console.log('startCamera() appelée');
      const alert = await this.alertCtrl.create({
        header: 'Caméra non supportée',
        message: `Votre navigateur ne supporte pas getUserMedia.`,
        buttons: ['OK'],
      });
      return alert.present();
    }

    const showFail = async (err: any, msgFallback?: string) => {
      console.error('getUserMedia error:', err);
      const msg =
        err?.name === 'NotAllowedError'
          ? `Accès à la caméra refusé. Autorise la caméra pour http://localhost:8100.`
          : err?.name === 'NotFoundError'
          ? `Aucune caméra détectée. Branche une webcam.`
          : err?.name === 'NotReadableError'
          ? `La caméra est utilisée par une autre application (Teams/Zoom/OBS).`
          : msgFallback || `Caméra indisponible. Vérifie les permissions ou branche une caméra.`;
      const alert = await this.alertCtrl.create({ header: 'Caméra indisponible', message: msg, buttons: ['OK'] });
      await alert.present();
    };

    try {
      // 1) liste les devices vidéo et prend le premier
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      console.log('Video inputs:', cams);
      console.log('Caméras détectées :', cams);

      if (cams.length === 0) {
        return showFail({ name: 'NotFoundError' });
      }

      // 2) essaie avec le premier deviceId
      try {
        await this.openStream(cams[0].deviceId || undefined);
      } catch (e1) {
        // 3) fallback sans deviceId (laisser le navigateur choisir)
        try {
          await this.openStream();
        } catch (e2) {
          return showFail(e2);
        }
      }
    } catch (err) {
      return showFail(err);
    }
  }

  stopCamera() {
    this.streaming = false;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
    const video = this.videoRef?.nativeElement;
    if (video) {
      video.pause();
      try { (video as any).srcObject = null; } catch {}
    }
  }

  async takeSnapshot() {
    const video = this.videoRef?.nativeElement;
    if (!this.streaming || !video || video.readyState < 2) return;

    const canvas = this.canvasRef.nativeElement;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    await this.photoService.saveFromDataUrl(dataUrl);
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
}
