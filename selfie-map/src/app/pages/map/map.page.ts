// import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
// import { IonicModule } from '@ionic/angular';
// import { CommonModule } from '@angular/common';
// import { ActivatedRoute } from '@angular/router';
// import * as maplibregl from 'maplibre-gl';
// import { PhotoService } from '../../core/photo.service';

// // (optionnel) carrousel pour les photos d’un cluster
// import { register } from 'swiper/element/bundle';
// register();

// @Component({
//   standalone: true,
//   selector: 'app-map',
//   templateUrl: './map.page.html',
//   styleUrls: ['./map.page.scss'],
//   imports: [IonicModule, CommonModule],
// })
// export class MapPage implements OnInit, OnDestroy {
//   @ViewChild('mapEl') mapRef!: ElementRef<HTMLDivElement>;

//   private map?: maplibregl.Map;
//   private ro?: ResizeObserver;
//   private readonly mapSourceId = 'photos';

//   // état du carrousel (modal)
//   clusterOpen = false;
//   clusterLeaves: Array<any> = [];

//   constructor(
//     private route: ActivatedRoute,
//     private photoService: PhotoService
//   ) {}

//   async ngOnInit() {
//     // au cas où on arrive directement sur /map
//     await this.photoService.loadSaved();
//   }

//   async ionViewDidEnter() {
//     await this.initMap();
//   }

//   ngOnDestroy(): void {
//     try { this.ro?.disconnect(); } catch {}
//     this.map?.remove();
//     this.map = undefined;
//   }

//   /** ============== helpers ============== */

//   private async waitUntilVisible(el: HTMLElement): Promise<void> {
//     await new Promise<void>(resolve => {
//       const check = () => {
//         const ok = el.offsetParent !== null && el.clientWidth > 0 && el.clientHeight > 0;
//         if (ok) return resolve();
//         requestAnimationFrame(check);
//       };
//       check();
//     });
//   }

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

//   /** ============== map init ============== */
//   private async initMap() {
//     if (this.map) return;

//     const container = this.mapRef.nativeElement;
//     await this.waitUntilVisible(container);

//     const style: any = {
//       version: 8,
//       glyphs: 'https://demotiles.maplibre.org/fonts/{fontstack}/{range}.pbf',
//       sources: {
//         osm: {
//           type: 'raster',
//           tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
//           tileSize: 256,
//           attribution: '© OpenStreetMap contributors'
//         }
//       },
//       layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
//     };

//     const map = this.map = new (maplibregl as any).Map({
//       container,
//       style,
//       center: [2.33, 48.86],
//       zoom: 4
//     });

//     // resize auto
//     try { this.ro?.disconnect(); } catch {}
//     this.ro = new ResizeObserver(() => this.map?.resize());
//     this.ro.observe(container);

//     requestAnimationFrame(() => this.map?.resize());
//     setTimeout(() => this.map?.resize(), 150);

//     map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

//     map.on('load', () => {
//       const srcId = this.mapSourceId;

//       // source + clustering
//       map.addSource(srcId, {
//         type: 'geojson',
//         data: this.buildGeoJSON() as any,
//         cluster: true,
//         clusterMaxZoom: 14,
//         clusterRadius: 50
//       } as any);

//       // cercles des clusters
//       map.addLayer({
//         id: 'clusters',
//         type: 'circle',
//         source: srcId,
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

//       // texte des clusters
//       map.addLayer({
//         id: 'cluster-count',
//         type: 'symbol',
//         source: srcId,
//         filter: ['has', 'point_count'],
//         layout: {
//           'text-field': ['get', 'point_count_abbreviated'],
//           'text-font': ['Open Sans Regular'],
//           'text-size': 12
//         } as any
//       });

//       // click cluster -> zoom OU carousel des leaves
//       map.on('click', 'clusters', (e: any) => {
//         const feats = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
//         if (!feats.length) return;

//         const clusterId = (feats[0].properties as any)['cluster_id'];
//         const src = map.getSource(srcId) as any;

//         // on récupère les leaves pour le carrousel
//         src.getClusterLeaves(clusterId, 50, 0, (err: any, leaves: any[]) => {
//           if (err) return;
//           const withImages = leaves.filter(l => l?.properties?.image);
//           if (withImages.length) {
//             this.clusterLeaves = withImages;
//             this.clusterOpen = true;
//           } else {
//             // sinon, comportement "zoom" classique
//             src.getClusterExpansionZoom(clusterId, (err2: any, zoom: number) => {
//               if (err2) return;
//               const coords = (feats[0].geometry as any).coordinates;
//               map.easeTo({ center: coords, zoom });
//             });
//           }
//         });
//       });

//       map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
//       map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

//       // centrage via query params ?lat=..&lng=..&z=..
//       this.route.queryParamMap.subscribe(q => {
//         const lat = Number(q.get('lat'));
//         const lng = Number(q.get('lng'));
//         const z = Number(q.get('z') || 13);
//         if (isFinite(lat) && isFinite(lng)) {
//           map.easeTo({ center: [lng, lat], zoom: z });
//         } else {
//           const first = this.photoService.photos.find(p => p.coords);
//           if (first) map.easeTo({ center: [first.coords!.lng, first.coords!.lat], zoom: 10 });
//         }
//       });
//     });
//   }
// }



import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import * as maplibregl from 'maplibre-gl';
import { PhotoService } from '../../core/photo.service';

@Component({
  standalone: true,
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  imports: [IonicModule, CommonModule],
})
export class MapPage implements OnInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapRef!: ElementRef<HTMLDivElement>;

  private map?: maplibregl.Map;
  private mapPopup?: maplibregl.Popup;
  private mapSourceId = 'photos';

  constructor(private photoService: PhotoService) {}

  async ngOnInit() {
    // Précharge les photos si ce n'est pas déjà fait
    await this.photoService.loadSaved();
  }

  ionViewDidEnter() {
    // (ré)initialise la carte quand on entre sur la page
    if (!this.map) this.initMap();

    // met à jour les données (utile si on arrive depuis la prise de photo)
    this.refreshMapData();

    // assure le bon sizing après animation de page
    setTimeout(() => this.map?.resize(), 150);

    // centre automatiquement près de l’utilisateur (silencieux si refus)
    setTimeout(() => this.centerNearMe(), 300);
  }

  ngOnDestroy() {
    this.mapPopup?.remove();
    this.map?.remove();
  }

// Dans MapPage (à l'intérieur de la classe)
async centerNearMe() {
  if (!this.map) return;
  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 0
      })
    );
    this.map.easeTo({
      center: [pos.coords.longitude, pos.coords.latitude],
      zoom: 13,
      duration: 800
    });
  } catch {
    // Fallback: 1re photo connue ou centre par défaut
    const first = this.photoService.photos.find(p => p.coords);
    const center: [number, number] = first
      ? [first.coords!.lng, first.coords!.lat]
      : [2.33, 48.86];
    this.map.easeTo({ center, zoom: first ? 12 : 5, duration: 800 });
  }
}


  /** ====== 1) Regroupe les photos par lieu (coords arrondies) ====== */
  private buildGroupedGeoJSON() {
    const PREC = 5; // 5 décimales ~ 1.1 m — diminue pour regrouper plus large
    const buckets = new Map<
      string,
      { lng: number; lat: number; photos: Array<{ image: string; takenAt: number }> }
    >();

    for (const p of this.photoService.photos) {
      if (!p.coords) continue;
      const { lng, lat } = p.coords;
      const key = `${lng.toFixed(PREC)}|${lat.toFixed(PREC)}`;

      if (!buckets.has(key)) buckets.set(key, { lng, lat, photos: [] });

      // conversion robuste en number
      let takenAtNum: number;
      if (typeof p.takenAt === 'number') {
        takenAtNum = p.takenAt;
      } else {
        const parsed = Date.parse(p.takenAt as any);
        takenAtNum = Number.isNaN(parsed) ? +p.takenAt : parsed;
      }

      buckets.get(key)!.photos.push({
        image: p.webviewPath || '',
        takenAt: takenAtNum,
      });
    }

    const features = [...buckets.values()].map(b => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.lng, b.lat] },
      // ⚠️ certains pipelines GeoJSON n’aiment pas les objets profonds → on stringify
      properties: {
        count: b.photos.length,
        photos: JSON.stringify(b.photos),
      },
    }));

    return { type: 'FeatureCollection' as const, features };
  }

  /** ====== 2) Init carte + source clusterisée + couches ====== */
  private initMap() {
    const style: any = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    };

    const map = (this.map = new (maplibregl as any).Map({
      container: this.mapRef.nativeElement,
      style,
      center: [2.33, 48.86],
      zoom: 3,
    }));

    map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

    map.on('load', () => {
      // Source clusterisée
      map.addSource(this.mapSourceId, {
        type: 'geojson',
        data: this.buildGroupedGeoJSON() as any,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      } as any);

      // Cercles des clusters (plus gros + halo blanc)
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: this.mapSourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#9AD9FF', 10, '#5DB8FF',
            30, '#2F8CFF',
            100, '#1E64D2'
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            24, 10, 30, 30, 38, 100, 46
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        } as any,
      });

      // Label compteur des clusters (plus grand + halo)
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: this.mapSourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Regular'],
          'text-size': 16,
          'text-offset': [0, 0.02],
        } as any,
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.35)',
          'text-halo-width': 1.5
        } as any
      });

      // Points non clusterisés (1 point = 1 lieu regroupé)
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: this.mapSourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#FF4D6D',
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        } as any,
      });

      // Interactions clusters → zoom/développer
      map.on('click', 'clusters', (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = (features[0].properties as any)['cluster_id'];
        const src = map.getSource(this.mapSourceId) as any;
        src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          const coords = (features[0].geometry as any).coordinates;
          map.easeTo({ center: coords, zoom });
        });
      });

      // Clic sur un point → popup carrousel
      map.on('click', 'unclustered-point', (e: any) => {
        const f = e.features[0];
        const coords = f.geometry.coordinates.slice();
        const raw = f.properties.photos;
        const photos: Array<{ image: string; takenAt: number }> =
          typeof raw === 'string' ? JSON.parse(raw) : raw || [];
        const count = f.properties.count || photos.length;

        const html = this.renderCarouselPopup(photos, count);

        this.mapPopup?.remove();
        this.mapPopup = new maplibregl.Popup({ closeOnClick: true, maxWidth: '320px' })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseenter', 'clusters', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'clusters', () => (map.getCanvas().style.cursor = ''));
      map.on('mouseenter', 'unclustered-point', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'unclustered-point', () => (map.getCanvas().style.cursor = ''));
    });
  }

  /** ====== 3) Popup carrousel pour un “lieu” ====== */
  private renderCarouselPopup(
    photos: Array<{ image: string; takenAt: number }>,
    count: number
  ) {
    if (!photos || !photos.length) return '<div>Aucune photo</div>';

    const main = photos[0].image || '';
    const thumbs = photos
      .map(
        (p, i) => `
          <img src="${p.image}" data-idx="${i}" style="
            width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;margin-right:6px;
            border:1px solid rgba(0,0,0,.1);
          "/>`
      )
      .join('');

    const js = `
      <script>
        (function(){
          const wrap = document.currentScript.parentElement;
          const main = wrap.querySelector('img[data-main]');
          wrap.querySelectorAll('img[data-idx]').forEach(img=>{
            img.addEventListener('click', ()=>{ main.src = img.src; });
          });
        })();
      </script>
    `;

    return `
      <div style="width:260px">
        <div style="font-size:12px;opacity:.8;margin-bottom:6px">${count} photo${count>1?'s':''} à cet endroit</div>
        <div style="width:100%;height:160px;background:#000;border-radius:8px;overflow:hidden;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
          <img data-main src="${main}" style="max-width:100%;max-height:100%;display:block"/>
        </div>
        <div style="display:flex;overflow:auto;padding-bottom:2px">${thumbs}</div>
        ${js}
      </div>
    `;
  }

  /** ====== 4) Met à jour la source quand les photos changent ====== */
  refreshMapData() {
    if (!this.map) return;
    const src = this.map.getSource(this.mapSourceId) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(this.buildGroupedGeoJSON() as any);
  }
}
