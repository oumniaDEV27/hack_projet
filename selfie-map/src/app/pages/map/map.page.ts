import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import * as maplibregl from 'maplibre-gl';
import { PhotoService } from '../../core/photo.service';

// (optionnel) carrousel pour les photos d’un cluster
import { register } from 'swiper/element/bundle';
register();

@Component({
  standalone: true,
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  imports: [IonicModule, CommonModule],
})
export class MapPage implements OnInit, OnDestroy {
  @ViewChild('mapEl') mapRef!: ElementRef<HTMLDivElement>;

  private map?: maplibregl.Map;
  private ro?: ResizeObserver;
  private readonly mapSourceId = 'photos';

  // état du carrousel (modal)
  clusterOpen = false;
  clusterLeaves: Array<any> = [];

  constructor(
    private route: ActivatedRoute,
    private photoService: PhotoService
  ) {}

  async ngOnInit() {
    // au cas où on arrive directement sur /map
    await this.photoService.loadSaved();
  }

  async ionViewDidEnter() {
    await this.initMap();
  }

  ngOnDestroy(): void {
    try { this.ro?.disconnect(); } catch {}
    this.map?.remove();
    this.map = undefined;
  }

  /** ============== helpers ============== */

  private async waitUntilVisible(el: HTMLElement): Promise<void> {
    await new Promise<void>(resolve => {
      const check = () => {
        const ok = el.offsetParent !== null && el.clientWidth > 0 && el.clientHeight > 0;
        if (ok) return resolve();
        requestAnimationFrame(check);
      };
      check();
    });
  }

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

  /** ============== map init ============== */
  private async initMap() {
    if (this.map) return;

    const container = this.mapRef.nativeElement;
    await this.waitUntilVisible(container);

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
      zoom: 4
    });

    // resize auto
    try { this.ro?.disconnect(); } catch {}
    this.ro = new ResizeObserver(() => this.map?.resize());
    this.ro.observe(container);

    requestAnimationFrame(() => this.map?.resize());
    setTimeout(() => this.map?.resize(), 150);

    map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

    map.on('load', () => {
      const srcId = this.mapSourceId;

      // source + clustering
      map.addSource(srcId, {
        type: 'geojson',
        data: this.buildGeoJSON() as any,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      } as any);

      // cercles des clusters
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

      // texte des clusters
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

      // click cluster -> zoom OU carousel des leaves
      map.on('click', 'clusters', (e: any) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!feats.length) return;

        const clusterId = (feats[0].properties as any)['cluster_id'];
        const src = map.getSource(srcId) as any;

        // on récupère les leaves pour le carrousel
        src.getClusterLeaves(clusterId, 50, 0, (err: any, leaves: any[]) => {
          if (err) return;
          const withImages = leaves.filter(l => l?.properties?.image);
          if (withImages.length) {
            this.clusterLeaves = withImages;
            this.clusterOpen = true;
          } else {
            // sinon, comportement "zoom" classique
            src.getClusterExpansionZoom(clusterId, (err2: any, zoom: number) => {
              if (err2) return;
              const coords = (feats[0].geometry as any).coordinates;
              map.easeTo({ center: coords, zoom });
            });
          }
        });
      });

      map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
      map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');

      // centrage via query params ?lat=..&lng=..&z=..
      this.route.queryParamMap.subscribe(q => {
        const lat = Number(q.get('lat'));
        const lng = Number(q.get('lng'));
        const z = Number(q.get('z') || 13);
        if (isFinite(lat) && isFinite(lng)) {
          map.easeTo({ center: [lng, lat], zoom: z });
        } else {
          const first = this.photoService.photos.find(p => p.coords);
          if (first) map.easeTo({ center: [first.coords!.lng, first.coords!.lat], zoom: 10 });
        }
      });
    });
  }
}
