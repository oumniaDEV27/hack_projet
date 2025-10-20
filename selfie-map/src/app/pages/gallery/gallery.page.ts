// import { Component, ElementRef, OnDestroy, OnInit, ViewChild, HostListener } from '@angular/core';
// import { IonicModule, AlertController } from '@ionic/angular';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { PhotoService } from '../../core/photo.service';
// import * as maplibregl from 'maplibre-gl';
// import { environment } from '../../../environments/environment';




// @Component({
//   standalone: true,
//   selector: 'app-gallery',
//   templateUrl: './gallery.page.html',
//   styleUrls: ['./gallery.page.scss'],
//   imports: [IonicModule, CommonModule, FormsModule],
// })


// export class GalleryPage implements OnInit, OnDestroy {
//   /* ------- Caméra ------- */
//   @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
//   @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
//   streaming = false;
//   private stream?: MediaStream;

//   /* ------- Carte ------- */
//   @ViewChild('mapEl') mapRef!: ElementRef<HTMLDivElement>;
//   private map?: maplibregl.Map;
//   private mapSourceId = 'photos';
//   private mapPopup?: maplibregl.Popup;

//   view: 'grid' | 'map' = 'map'; // démarrer sur la carte pour tester



//   constructor(
//     public photoService: PhotoService,
//     private alertCtrl: AlertController
//   ) {}

//   async ngOnInit() {
//     // Charger les photos (coords, etc.)
//     await this.photoService.loadSaved();
//     // Ne PAS créer la carte ici : la vue n'est pas encore stable
//   }

//   // Appelé quand la page est réellement visible (après animations Ionic)
//   ionViewDidEnter() {
//     if (this.view === 'map') {
//       this.initMapIfNeeded();
//       this.resizeMapSoon();
//     }
//   }

  
// onViewChange() {
//   if (this.view === 'map') {
//     setTimeout(async () => {
//       await this.initMapIfNeeded();
//       this.map?.resize();
//     }, 0);
//   } else {
//     // 👇 démonte VRAIMENT la carte si on quitte l'onglet
//     if (this.map) {
//       try { this.ro?.disconnect(); } catch {}
//       this.mapPopup?.remove();
//       this.map.remove();
//       this.map = undefined;
//     }
//   }
// }

//   /* ================== util: resize avec délais ================== */
//   private resizeMapSoon() {
//     // Plusieurs passages pour couvrir les transitions/DOM reflow
//     requestAnimationFrame(() => this.map?.resize());
//     setTimeout(() => this.map?.resize(), 120);
//     setTimeout(() => this.map?.resize(), 300);
//   }

//   @HostListener('window:resize')
//   onWindowResize() {
//     this.map?.resize();
//   }

//   /* ================== CAMÉRA ================== */
//   private async openStream(deviceId?: string) {
//     const constraints: MediaStreamConstraints = deviceId
//       ? { video: { deviceId: { exact: deviceId } }, audio: false }
//       : { video: true, audio: false };

//     this.stream?.getTracks().forEach(t => t.stop());
//     this.stream = await navigator.mediaDevices.getUserMedia(constraints);

//     const video = this.videoRef.nativeElement;
//     try { (video as any).srcObject = null; } catch {}
//     (video as any).srcObject = this.stream;

//     video.setAttribute('autoplay', '');
//     video.setAttribute('muted', '');
//     video.setAttribute('playsinline', '');

//     await video.play();
//     this.streaming = true;
//   }

//   async startCamera() {
//     if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
//       const alert = await this.alertCtrl.create({
//         header: 'Caméra non supportée',
//         message: 'Votre navigateur ne supporte pas getUserMedia.',
//         buttons: ['OK'],
//       });
//       return alert.present();
//     }

//     const showFail = async (err: any, msgFallback?: string) => {
//       console.error('getUserMedia error:', err);
//       const msg =
//         err?.name === 'NotAllowedError' ? 'Accès à la caméra refusé.'
//         : err?.name === 'NotFoundError' ? 'Aucune caméra détectée.'
//         : err?.name === 'NotReadableError' ? 'La caméra est utilisée par une autre application.'
//         : msgFallback || 'Caméra indisponible.';
//       const alert = await this.alertCtrl.create({ header: 'Caméra', message: msg, buttons: ['OK'] });
//       await alert.present();
//     };

//     try {
//       const devices = await navigator.mediaDevices.enumerateDevices();
//       const cams = devices.filter(d => d.kind === 'videoinput');
//       if (cams.length === 0) return showFail({ name: 'NotFoundError' });

//       try {
//         await this.openStream(cams[0].deviceId || undefined);
//       } catch {
//         try { await this.openStream(); } catch (e2) { return showFail(e2); }
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
//     canvas.width = w; canvas.height = h;

//     const ctx = canvas.getContext('2d')!;
//     ctx.drawImage(video, 0, 0, w, h);
//     const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

//     await this.photoService.saveFromDataUrl(dataUrl);
//     this.refreshMapData();
//     if (this.view === 'map') this.resizeMapSoon();
//   }

//   async confirmDelete(i: number) {
//     const alert = await this.alertCtrl.create({
//       header: 'Supprimer cette photo ?',
//       buttons: [
//         { text: 'Annuler', role: 'cancel' },
//         { text: 'Supprimer', role: 'destructive', handler: () => {
//           this.photoService.removeAt(i);
//           setTimeout(() => this.refreshMapData(), 0);
//         } }
//       ],
//     });
//     await alert.present();
//   }

//   toggleLike(i: number) {
//     this.photoService.toggleLike(i);
//   }

//   /* ================== CARTE ================== */
//   private buildGeoJSON() {
//     const features = this.photoService.photos
//       .filter(p => !!p.coords)
//       .map(p => ({
//         type: 'Feature' as const,
//         geometry: { type: 'Point' as const, coordinates: [p.coords!.lng, p.coords!.lat] },
//         properties: { takenAt: p.takenAt, image: p.webviewPath || '' },
//       }));
//     return { type: 'FeatureCollection' as const, features };
//   }

// private initMapIfNeeded() {
//   if (this.map || !this.mapRef || this.view !== 'map') return;

//   const style: any = {
//     version: 8,
//     glyphs: 'https://demotiles.maplibre.org/fonts/{fontstack}/{range}.pbf',
//     sources: {
//       osm: {
//         type: 'raster',
//         tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
//         tileSize: 256,
//         attribution: '© OpenStreetMap contributors'
//       }
//     },
//     layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
//   };

//   const map = this.map = new (maplibregl as any).Map({
//     container: this.mapRef.nativeElement,
//     style,
//     center: [2.33, 48.86],
//     zoom: 3
//   });

//   this.resizeMapSoon();
//   map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

//   map.on('error', (ev: any) => console.error('MapLibre error:', ev?.error || ev));

//   map.on('load', () => {
//     // --- Source: upsert ---
//     const existingSrc = map.getSource(this.mapSourceId) as maplibregl.GeoJSONSource | undefined;
//     if (existingSrc) {
//       existingSrc.setData(this.buildGeoJSON() as any);
//     } else {
//       map.addSource(this.mapSourceId, {
//         type: 'geojson',
//         data: this.buildGeoJSON() as any,
//         cluster: true,
//         clusterMaxZoom: 14,
//         clusterRadius: 50
//       } as any);
//     }

//     // --- Layers: add only if missing ---
//     if (!map.getLayer('clusters')) {
//       map.addLayer({
//         id: 'clusters',
//         type: 'circle',
//         source: this.mapSourceId,
//         filter: ['has', 'point_count'],
//         paint: {
//           'circle-color': [
//             'step', ['get', 'point_count'],
//             '#A0E3FF', 10, '#7CC1F2', 30, '#4E8AD9', 100, '#2F5FB3'
//           ],
//           'circle-radius': [
//             'step', ['get', 'point_count'],
//             18, 10, 22, 30, 28, 100, 34
//           ]
//         } as any
//       });
//     }

//     if (!map.getLayer('cluster-count')) {
//       map.addLayer({
//         id: 'cluster-count',
//         type: 'symbol',
//         source: this.mapSourceId,
//         filter: ['has', 'point_count'],
//         layout: {
//           'text-field': ['get', 'point_count_abbreviated'],
//           // IMPORTANT: pas d'espace parasite, et 1 police suffit
//           'text-font': ['Open Sans Regular'],
//           'text-size': 12
//         } as any
//       });
//     }

//     if (!map.getLayer('unclustered-point')) {
//       map.addLayer({
//         id: 'unclustered-point',
//         type: 'circle',
//         source: this.mapSourceId,
//         filter: ['!', ['has', 'point_count']],
//         paint: {
//           'circle-color': '#FF4D6D',
//           'circle-radius': 6,
//           'circle-stroke-width': 1.5,
//           'circle-stroke-color': '#ffffff'
//         } as any
//       });
//     }

//     // Interactions (inchangées)
//     map.on('click', 'clusters', (e: any) => {
//       const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
//       if (!features.length) return;
//       const clusterId = (features[0].properties as any)['cluster_id'];
//       const src = map.getSource(this.mapSourceId) as any;
//       src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
//         if (err) return;
//         const coords = (features[0].geometry as any).coordinates;
//         map.easeTo({ center: coords, zoom });
//       });
//     });

//     map.on('click', 'unclustered-point', (e: any) => {
//       const feat = e.features[0];
//       const coords = feat.geometry.coordinates.slice();
//       const takenAt = feat.properties.takenAt;
//       const image = feat.properties.image;
//       const html = `
//         <div style="max-width:180px">
//           <div style="font-size:12px;opacity:.8;margin-bottom:4px">${new Date(+takenAt).toLocaleString()}</div>
//           ${image ? `<img src="${image}" style="width:100%;border-radius:8px;display:block"/>` : ''}
//         </div>
//       `;
//       this.mapPopup?.remove();
//       this.mapPopup = new maplibregl.Popup({ closeOnClick: true })
//         .setLngLat(coords)
//         .setHTML(html)
//         .addTo(map);
//     });

//     map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
//     map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
//     map.on('mouseenter', 'unclustered-point', () => map.getCanvas().style.cursor = 'pointer');
//     map.on('mouseleave', 'unclustered-point', () => map.getCanvas().style.cursor = '');

//     const first = this.photoService.photos.find(p => p.coords);
//     if (first) map.easeTo({ center: [first.coords!.lng, first.coords!.lat], zoom: 10 });
//   });
// }


//   private refreshMapData() {
//     if (!this.map) return;
//     const src = this.map.getSource(this.mapSourceId) as maplibregl.GeoJSONSource | undefined;
//     if (!src) return;
//     src.setData(this.buildGeoJSON() as any);
//   }

//   /* ================== Bonus ================== */
//   async centerOnMe() {
//     if (!this.map) return;
//     try {
//       const pos = await new Promise<GeolocationPosition>((res, rej) =>
//         navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
//       );
//       this.view = 'map';
//       (this.map as maplibregl.Map).easeTo({
//         center: [pos.coords.longitude, pos.coords.latitude],
//         zoom: 13
//       });
//       this.resizeMapSoon();
//     } catch {
//       const alert = await this.alertCtrl.create({
//         header: 'Géolocalisation',
//         message: `Impossible d'obtenir votre position (permissions ou GPS).`,
//         buttons: ['OK'],
//       });
//       alert.present();
//     }
//   }

//   focusOnPhoto(i: number) {
//     const p = this.photoService.photos[i];
//     if (!p?.coords || !this.map) return;
//     this.view = 'map';
//     (this.map as maplibregl.Map).easeTo({ center: [p.coords.lng, p.coords.lat], zoom: 14 });

//     const html = `
//       <div style="max-width:180px">
//         <div style="font-size:12px;opacity:.8;margin-bottom:4px">${new Date(p.takenAt).toLocaleString()}</div>
//         ${p.webviewPath ? `<img src="${p.webviewPath}" style="width:100%;border-radius:8px;display:block"/>` : ''}
//       </div>
//     `;
//     this.mapPopup?.remove();
//     this.mapPopup = new maplibregl.Popup({ closeOnClick: true })
//       .setLngLat([p.coords.lng, p.coords.lat] as any)
//       .setHTML(html)
//       .addTo(this.map!);

//     this.resizeMapSoon();
//   }
// }


import { Component, ElementRef, OnDestroy, OnInit, ViewChild, HostListener } from '@angular/core';
import { IonicModule, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoService } from '../../core/photo.service';
import * as maplibregl from 'maplibre-gl';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-gallery',
  templateUrl: './gallery.page.html',
  styleUrls: ['./gallery.page.scss'],
  imports: [IonicModule, CommonModule, FormsModule],
})
export class GalleryPage implements OnInit, OnDestroy {
  /* ------- Caméra ------- */
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;
  streaming = false;
  private stream?: MediaStream;

  /* ------- Carte ------- */
  @ViewChild('mapEl') mapRef!: ElementRef<HTMLDivElement>;
  private map?: maplibregl.Map;
  private mapSourceId = 'photos';
  private mapPopup?: maplibregl.Popup;
  private ro?: ResizeObserver;

  // Démarrer sur la GALERIE
  view: 'grid' | 'map' = 'grid';

  constructor(
    public photoService: PhotoService,
    private alertCtrl: AlertController
  ) {}

  async ngOnInit() {
    // Charger les photos (coords, etc.)
    await this.photoService.loadSaved();
    // Ne PAS créer la carte ici : la vue n'est pas encore stable
  }

  // Appelé quand la page est réellement visible (après animations Ionic)
  async ionViewDidEnter() {
    if (this.view === 'map') {
      await this.initMapIfNeeded();
      this.resizeMapSoon();
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.mapPopup?.remove();
    try { this.ro?.disconnect(); } catch {}
    this.map?.remove();
    this.map = undefined;
  }

onViewChange() {
  if (this.view === 'map') {
    setTimeout(async () => {
      await this.initMapIfNeeded();
      this.map?.resize();
    }, 0);
  } else {
    // 👇 démonte VRAIMENT la carte si on quitte l'onglet
    if (this.map) {
      try { this.ro?.disconnect(); } catch {}
      this.mapPopup?.remove();
      this.map.remove();
      this.map = undefined;
    }
  }
}

  /* ================== util: resize avec délais ================== */
  private resizeMapSoon() {
    // Plusieurs passages pour couvrir les transitions/DOM reflow
    requestAnimationFrame(() => this.map?.resize());
    setTimeout(() => this.map?.resize(), 120);
    setTimeout(() => this.map?.resize(), 300);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.map?.resize();
  }

  /* === Helpers visibilité / readiness === */
  private waitUntilVisible(el: HTMLElement): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        const visible = el.offsetParent !== null && el.clientWidth > 0 && el.clientHeight > 0;
        if (visible) return resolve();
        requestAnimationFrame(check);
      };
      check();
    });
  }

  private async ensureMapReady(): Promise<maplibregl.Map> {
    if (!this.map) {
      await this.initMapIfNeeded();
    }
    if ((this.map as any)?._loaded !== true) {
      await new Promise<void>(res => this.map!.once('load', () => res()));
    }
    this.map!.resize();
    return this.map!;
  }

  /* ================== CAMÉRA ================== */
  private async openStream(deviceId?: string) {
    const constraints: MediaStreamConstraints = deviceId
      ? { video: { deviceId: { exact: deviceId } }, audio: false }
      : { video: true, audio: false };

    this.stream?.getTracks().forEach(t => t.stop());
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

  async startCamera() {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      const alert = await this.alertCtrl.create({
        header: 'Caméra non supportée',
        message: 'Votre navigateur ne supporte pas getUserMedia.',
        buttons: ['OK'],
      });
      return alert.present();
    }

    const showFail = async (err: any, msgFallback?: string) => {
      console.error('getUserMedia error:', err);
      const msg =
        err?.name === 'NotAllowedError' ? 'Accès à la caméra refusé.'
        : err?.name === 'NotFoundError' ? 'Aucune caméra détectée.'
        : err?.name === 'NotReadableError' ? 'La caméra est utilisée par une autre application.'
        : msgFallback || 'Caméra indisponible.';
      const alert = await this.alertCtrl.create({ header: 'Caméra', message: msg, buttons: ['OK'] });
      await alert.present();
    };

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      if (cams.length === 0) return showFail({ name: 'NotFoundError' });

      try {
        await this.openStream(cams[0].deviceId || undefined);
      } catch {
        try { await this.openStream(); } catch (e2) { return showFail(e2); }
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
    canvas.width = w; canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    await this.photoService.saveFromDataUrl(dataUrl);
    this.refreshMapData();
    if (this.view === 'map') this.resizeMapSoon();
  }

  async confirmDelete(i: number) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer cette photo ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => {
          this.photoService.removeAt(i);
          setTimeout(() => this.refreshMapData(), 0);
        } }
      ],
    });
    await alert.present();
  }

  toggleLike(i: number) {
    this.photoService.toggleLike(i);
  }

  /* ================== CARTE ================== */
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

  private async initMapIfNeeded() {
    if (this.map || !this.mapRef || this.view !== 'map') return;

    const container = this.mapRef.nativeElement;
    // Attendre que le conteneur soit réellement visible et non-zéro
    await this.waitUntilVisible(container);

    // Style raster OSM + glyphs (nécessaires pour le texte des clusters)
    const style: any = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/fonts/{fontstack}/{range}.pbf',
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

    const map = this.map = new (maplibregl as any).Map({
      container,
      style,
      center: [2.33, 48.86],
      zoom: 3
    });

    // Resize auto quand la taille du conteneur change (onglet, rotation, clavier…)
    try { this.ro?.disconnect(); } catch {}
    this.ro = new ResizeObserver(() => this.map?.resize());
    this.ro.observe(container);

    // Kicks de sécurité
    this.resizeMapSoon();

    map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');
    map.on('error', (ev: any) => console.error('MapLibre error:', ev?.error || ev));

    map.on('load', () => {
      const srcId = this.mapSourceId;

      // Source GeoJSON (upsert) avec clustering
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(this.buildGeoJSON() as any);
      } else {
        map.addSource(srcId, {
          type: 'geojson',
          data: this.buildGeoJSON() as any,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        } as any);
      }

      // CLUSTERS (cercles)
      if (!map.getLayer('clusters')) {
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: srcId,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step', ['get', 'point_count'],
              '#A0E3FF', 10, '#7CC1F2', 30, '#4E8AD9', 100, '#2F5FB3'
            ],
            'circle-radius': [
              'step', ['get', 'point_count'],
              18, 10, 22, 30, 28, 100, 34
            ]
          } as any
        });
      }

      // TEXTE des clusters (compteur) — 1 police pour éviter les 404
      if (!map.getLayer('cluster-count')) {
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: srcId,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Regular'],
            'text-size': 12
          } as any
        });
      }

      // Interaction: zoomer sur un cluster au clic
      map.on('click', 'clusters', (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = (features[0].properties as any)['cluster_id'];
        const src = map.getSource(srcId) as any;
        src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          const coords = (features[0].geometry as any).coordinates;
          map.easeTo({ center: coords, zoom });
        });
      });
      map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

      // Centrer sur la première photo géolocalisée
      const first = this.photoService.photos.find(p => p.coords);
      if (first) map.easeTo({ center: [first.coords!.lng, first.coords!.lat], zoom: 10 });

      // Dernier resize après 'load'
      this.resizeMapSoon();
    });
  }

  private refreshMapData() {
    if (!this.map) return;
    const src = this.map.getSource(this.mapSourceId) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(this.buildGeoJSON() as any);
  }

  /* ================== Bonus ================== */
  async centerOnMe() {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
      );
      this.view = 'map';
      await Promise.resolve();
      const map = await this.ensureMapReady();
      map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
      this.resizeMapSoon();
    } catch {
      const alert = await this.alertCtrl.create({
        header: 'Géolocalisation',
        message: `Impossible d'obtenir votre position (permissions ou GPS).`,
        buttons: ['OK'],
      });
      alert.present();
    }
  }

  async focusOnPhoto(i: number) {
    const p = this.photoService.photos[i];
    if (!p?.coords) return;
    this.view = 'map';
    await Promise.resolve();
    const map = await this.ensureMapReady();
    map.easeTo({ center: [p.coords.lng, p.coords.lat], zoom: 14 });

    // (Popup désactivée car "clusters only"; dé-commente si besoin)
    // const html = `
    //   <div style="max-width:180px">
    //     <div style="font-size:12px;opacity:.8;margin-bottom:4px">${new Date(p.takenAt).toLocaleString()}</div>
    //     ${p.webviewPath ? `<img src="${p.webviewPath}" style="width:100%;border-radius:8px;display:block"/>` : ''}
    //   </div>
    // `;
    // this.mapPopup?.remove();
    // this.mapPopup = new maplibregl.Popup({ closeOnClick: true })
    //   .setLngLat([p.coords.lng, p.coords.lat] as any)
    //   .setHTML(html)
    //   .addTo(map);

    this.resizeMapSoon();
  }
}
