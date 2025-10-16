// import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
// import { IonicModule, AlertController } from '@ionic/angular';
// import { CommonModule } from '@angular/common';
// import { PhotoService } from '../../core/photo.service';

// @Component({
//   standalone: true,
//   selector: 'app-gallery',
//   templateUrl: './gallery.page.html',
//   // styleUrls: ['./gallery.page.scss'], // décommenter quand ton SCSS est OK
//   imports: [IonicModule, CommonModule],
// })
// export class GalleryPage implements OnInit, OnDestroy {
//   @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
//   @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

//   streaming = false;
//   private stream?: MediaStream;

//   constructor(
//     public photoService: PhotoService,
//     private alertCtrl: AlertController
//   ) {}

//   async ngOnInit() {
//     await this.photoService.loadSaved();
//   }

//   ngOnDestroy(): void {
//     this.stopCamera();
//   }

//   /** Ouvre un flux vidéo, soit sur un deviceId précis, soit "any" */
//   private async openStream(deviceId?: string) {
//     const constraints: MediaStreamConstraints = deviceId
//       ? { video: { deviceId: { exact: deviceId } }, audio: false }
//       : { video: true, audio: false };

//     // coupe l'ancien flux si présent
//     this.stream?.getTracks().forEach(t => t.stop());
//     console.log('Tentative ouverture flux avec contraintes:', constraints);
//     this.stream = await navigator.mediaDevices.getUserMedia(constraints);

//     const video = this.videoRef.nativeElement;
//     // nettoie puis assigne
//     try { (video as any).srcObject = null; } catch {}
//     (video as any).srcObject = this.stream;

//     // s'assure des attributs autoplay compatibles mobile
//     video.setAttribute('autoplay', '');
//     video.setAttribute('muted', '');
//     video.setAttribute('playsinline', '');

//     await video.play();
//     this.streaming = true;
//   }

//   // ✅ Version robuste : sélection explicite d’une caméra + fallback
//   async startCamera() {
//     if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
//       console.log('startCamera() appelée');
//       const alert = await this.alertCtrl.create({
//         header: 'Caméra non supportée',
//         message: `Votre navigateur ne supporte pas getUserMedia.`,
//         buttons: ['OK'],
//       });
//       return alert.present();
//     }

//     const showFail = async (err: any, msgFallback?: string) => {
//       console.error('getUserMedia error:', err);
//       const msg =
//         err?.name === 'NotAllowedError'
//           ? `Accès à la caméra refusé. Autorise la caméra pour http://localhost:8100.`
//           : err?.name === 'NotFoundError'
//           ? `Aucune caméra détectée. Branche une webcam.`
//           : err?.name === 'NotReadableError'
//           ? `La caméra est utilisée par une autre application (Teams/Zoom/OBS).`
//           : msgFallback || `Caméra indisponible. Vérifie les permissions ou branche une caméra.`;
//       const alert = await this.alertCtrl.create({ header: 'Caméra indisponible', message: msg, buttons: ['OK'] });
//       await alert.present();
//     };

//     try {
//       // 1) liste les devices vidéo et prend le premier
//       const devices = await navigator.mediaDevices.enumerateDevices();
//       const cams = devices.filter(d => d.kind === 'videoinput');
//       console.log('Video inputs:', cams);
//       console.log('Caméras détectées :', cams);

//       if (cams.length === 0) {
//         return showFail({ name: 'NotFoundError' });
//       }

//       // 2) essaie avec le premier deviceId
//       try {
//         await this.openStream(cams[0].deviceId || undefined);
//       } catch (e1) {
//         // 3) fallback sans deviceId (laisser le navigateur choisir)
//         try {
//           await this.openStream();
//         } catch (e2) {
//           return showFail(e2);
//         }
//       }
//     } catch (err) {
//       return showFail(err);
//     }
//   }

//   stopCamera() {
//     this.streaming = false;
//     this.stream?.getTracks().forEach(t => t.stop());
//     this.stream = undefined;
//     const video = this.videoRef?.nativeElement;
//     if (video) {
//       video.pause();
//       try { (video as any).srcObject = null; } catch {}
//     }
//   }

//   async takeSnapshot() {
//     const video = this.videoRef?.nativeElement;
//     if (!this.streaming || !video || video.readyState < 2) return;

//     const canvas = this.canvasRef.nativeElement;
//     const w = video.videoWidth || 1280;
//     const h = video.videoHeight || 720;
//     canvas.width = w;
//     canvas.height = h;

//     const ctx = canvas.getContext('2d')!;
//     ctx.drawImage(video, 0, 0, w, h);
//     const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

//     await this.photoService.saveFromDataUrl(dataUrl);
//   }

//   async confirmDelete(i: number) {
//     const alert = await this.alertCtrl.create({
//       header: 'Supprimer cette photo ?',
//       buttons: [
//         { text: 'Annuler', role: 'cancel' },
//         { text: 'Supprimer', role: 'destructive', handler: () => this.photoService.removeAt(i) },
//       ],
//     });
//     await alert.present();
//   }

//   toggleLike(i: number) {
//     this.photoService.toggleLike(i);
//   }
// }


import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoService } from '../../core/photo.service';

// IMPORTANT: import MapLibre en namespace (sinon TS1192)
import * as maplibregl from 'maplibre-gl';

@Component({
  standalone: true,
  selector: 'app-gallery',
  templateUrl: './gallery.page.html',
  // styleUrls: ['./gallery.page.scss'], // décommenter quand ton SCSS est OK
  imports: [IonicModule, CommonModule, FormsModule],
})
export class GalleryPage implements OnInit, OnDestroy {
  /* ------- Caméra ------- */
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  streaming = false;
  private stream?: MediaStream;

  /* ------- Carte (MapLibre) ------- */
  @ViewChild('mapEl') mapRef!: ElementRef<HTMLDivElement>;
  private map?: maplibregl.Map;
  private mapSourceId = 'photos';
  private mapPopup?: maplibregl.Popup;

  // (facultatif) switch UI “Galerie/Carte”
  view: 'grid' | 'map' = 'grid';

  constructor(
    public photoService: PhotoService,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
    // laisse l’UI se rendre (#mapEl) puis init la carte
    setTimeout(() => this.initMapIfNeeded(), 0);
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.mapPopup?.remove();
    this.map?.remove();
  }

  /* =================== CAMÉRA =================== */

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
    try { (video as any).srcObject = null; } catch {}
    (video as any).srcObject = this.stream;

    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    await video.play();
    this.streaming = true;
  }

  // ✅ Version robuste : sélection explicite d’une caméra + fallback
  async startCamera() {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
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
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      console.log('Video inputs:', cams);

      if (cams.length === 0) return showFail({ name: 'NotFoundError' });

      try {
        await this.openStream(cams[0].deviceId || undefined);
      } catch (e1) {
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

    // ➜ Met à jour la carte après ajout
    this.refreshMapData();
  }

  async confirmDelete(i: number) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer cette photo ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => {
            this.photoService.removeAt(i);
            setTimeout(() => this.refreshMapData(), 0);
          }
        },
      ],
    });
    await alert.present();
  }

  toggleLike(i: number) {
    this.photoService.toggleLike(i);
  }

  /* =================== CARTE (MAPLIBRE) =================== */

  /** Construit un GeoJSON à partir des photos (seulement celles avec coords) */
  private buildGeoJSON() {
    const features = this.photoService.photos
      .filter(p => !!p.coords)
      .map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.coords!.lng, p.coords!.lat] },
        properties: { takenAt: p.takenAt, image: p.webviewPath || '' },
      }));
    return { type: 'FeatureCollection' as const, features };
  }

  /** Initialise la carte si pas encore créée */
  private initMapIfNeeded() {
    if (this.map || !this.mapRef) return;

    // Style OSM sans clé (raster)
    const style: any = {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    };

    this.map = new maplibregl.Map({
      container: this.mapRef.nativeElement,
      style,
      center: [2.33, 48.86], // Paris par défaut
      zoom: 3,
    });

    // ➜ ajoute `!` pour lever TS2532
    this.map!.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.map!.on('load', () => {
      // Source clusterisée
      this.map!.addSource(this.mapSourceId, {
        type: 'geojson',
        data: this.buildGeoJSON() as any,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      } as any);

      // Couche clusters
      this.map!.addLayer({
        id: 'clusters',
        type: 'circle',
        source: this.mapSourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#51bbd6', 10,
            '#f1f075', 25,
            '#f28cb1'
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            18, 10,
            24, 25,
            30
          ]
        }
      } as any);

      // Étiquette du nb d’éléments dans le cluster
      this.map!.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: this.mapSourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12
        }
      } as any);

      // Points non clusterisés
      this.map!.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: this.mapSourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#11b4da',
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      } as any);

      // Clic sur cluster → zoom d’expansion
      this.map!.on('click', 'clusters', (e: any) => {
        const features = this.map!.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties!['cluster_id'];
        const source = this.map!.getSource(this.mapSourceId) as maplibregl.GeoJSONSource;
        (source as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          this.map!.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      // Clic sur point → popup miniature + date
      this.map!.on('click', 'unclustered-point', (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates.slice();
        const props = f.properties || {};
        const img = props['image'];
        const takenAt = props['takenAt'];

        const html = `
          <div style="max-width:180px">
            <div style="font-size:12px;opacity:.8;margin-bottom:4px">${new Date(takenAt).toLocaleString()}</div>
            ${img ? `<img src="${img}" style="width:100%;border-radius:8px;display:block"/>` : ''}
          </div>
        `;

        this.mapPopup?.remove();
        this.mapPopup = new maplibregl.Popup({ closeOnClick: true })
          .setLngLat(coords as any)
          .setHTML(html)
          .addTo(this.map!);
      });

      // curseur main
      this.map!.on('mouseenter', 'clusters', () => this.map!.getCanvas().style.cursor = 'pointer');
      this.map!.on('mouseleave', 'clusters', () => this.map!.getCanvas().style.cursor = '');
      this.map!.on('mouseenter', 'unclustered-point', () => this.map!.getCanvas().style.cursor = 'pointer');
      this.map!.on('mouseleave', 'unclustered-point', () => this.map!.getCanvas().style.cursor = '');

      // Données initiales
      this.refreshMapData();
    });
  }

  /** Met à jour les données GeoJSON/cluster et recadre si besoin */
  private refreshMapData() {
    if (!this.map) return;
    const src = this.map.getSource(this.mapSourceId) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData(this.buildGeoJSON() as any);

    const first = this.photoService.photos.find(p => p.coords);
    if (first) {
      this.map!.easeTo({ center: [first.coords!.lng, first.coords!.lat], zoom: 10 });
    }
  }
}

