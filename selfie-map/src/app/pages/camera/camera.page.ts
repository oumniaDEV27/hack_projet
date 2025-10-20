import { Component, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PhotoService } from '../../core/photo.service';

@Component({
  standalone: true,
  selector: 'app-camera',
  templateUrl: './camera.page.html',
  styleUrls: ['./camera.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class CameraPage implements OnDestroy {
  @ViewChild('videoEl',  { static: true }) videoRef!:  ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private stream?: MediaStream;
  private starting = false;

  previewing = false;   // flux live actif ?
  useFront   = true;    // caméra front par défaut
  isReview   = false;   // mode REVIEW (affiche la photo capturée)
  snapshotDataUrl: string | null = null;

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private router: Router,
    private photoService: PhotoService
  ) {}

  ionViewDidEnter() {
    // auto-start si tu veux ; sinon commente
    this.startPreview().catch(() => {});
  }

  ngOnDestroy() { this.stopPreview(); }

  private readableError(err: any): string {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Accès refusé. Autorise la caméra dans le navigateur puis recharge.';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Aucune caméra détectée.';
    if (name === 'OverconstrainedError') return 'Résolution non supportée. Réessaie.';
    if (name === 'SecurityError') return 'Contexte non sécurisé. Utilise http://localhost:8100 ou HTTPS.';
    return err?.message || 'Erreur inconnue.';
  }

  /** LIVE: démarre la prévisualisation caméra */
  async startPreview() {
    if (this.starting) return;
    this.starting = true;
    try {
      // on repasse en mode LIVE (cache l’image review)
      this.isReview = false;
      this.snapshotDataUrl = null;

      await this.stopPreview();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.useFront ? 'user' : 'environment',
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const video = this.videoRef.nativeElement;
      try { await video.pause(); } catch {}
      try { (video as any).srcObject = null; } catch {}

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      (video as any).srcObject = this.stream;
      video.setAttribute('playsinline', '');
      video.muted = true;

      await new Promise<void>(resolve => {
        if (video.readyState >= 1) return resolve();
        const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); resolve(); };
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
      });

      try {
        await video.play();
      } catch (err: any) {
        if (err?.name !== 'AbortError') throw err;
      }

      this.previewing = true;
    } catch (err) {
      console.error('Preview error:', err);
      const a = await this.alertCtrl.create({
        header: 'Caméra',
        message: this.readableError(err),
        buttons: ['OK'],
      });
      await a.present();
      throw err;
    } finally {
      this.starting = false;
    }
  }

  /** STOP: coupe le flux */
  async stopPreview() {
    this.previewing = false;
    const video = this.videoRef?.nativeElement;
    if (video) {
      try { await video.pause(); } catch {}
      try { (video as any).srcObject = null; } catch {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = undefined;
    }
  }

  /** LIVE -> LIVE: inverse la caméra */
  async switchCamera() {
    this.useFront = !this.useFront;
    if (this.previewing || this.starting) {
      await this.startPreview();
    }
  }

  /** LIVE -> REVIEW: capture et affiche l’image */
  async takeSnapshot() {
    if (!this.previewing) return;

    const video = this.videoRef.nativeElement;
    if (video.readyState < 2) return;

    const canvas = this.canvasRef.nativeElement;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w; canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    if (this.useFront) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);

    this.snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // passe en mode REVIEW : cache la vidéo, montre l’image capturée
    this.isReview = true;

    // optionnel: on peut mettre pause pour “geler” le flux pendant la review
    try { await video.pause(); } catch {}
  }

  /** REVIEW -> LIVE: on recommence */
  async retake() {
    this.isReview = false;
    this.snapshotDataUrl = null;
    // relance le flux si nécessaire
    if (!this.previewing) {
      await this.startPreview();
    } else {
      try { await this.videoRef.nativeElement.play(); } catch {}
    }
  }

  /** REVIEW -> save + retour */
  async usePhoto() {
    if (!this.snapshotDataUrl) return;
    await this.photoService.saveFromDataUrl(this.snapshotDataUrl);
    const t = await this.toastCtrl.create({ message: 'Photo enregistrée', duration: 1200 });
    await t.present();
    await this.stopPreview();
    this.router.navigateByUrl('/photos');
  }
}
