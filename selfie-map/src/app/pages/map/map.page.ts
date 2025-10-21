
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
    await this.photoService.loadSaved();
  }

  ionViewDidEnter() {
    if (!this.map) this.initMap();
    this.refreshMapData();
    setTimeout(() => this.map?.resize(), 120);
  }

  ngOnDestroy() {
    this.mapPopup?.remove();
    this.map?.remove();
  }


  private buildGroupedGeoJSON() {
    const PREC = 5; // ~1.1 m
    const buckets = new Map<
      string,
      { lng: number; lat: number; photos: Array<{ image: string; takenAt: number }> }
    >();

    let totalWithCoords = 0;

    for (const p of this.photoService.photos) {
      if (!p?.coords) continue;
      const lng = Number((p.coords as any).lng);
      const lat = Number((p.coords as any).lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

      totalWithCoords++;
      const key = `${lng.toFixed(PREC)}|${lat.toFixed(PREC)}`;
      if (!buckets.has(key)) buckets.set(key, { lng, lat, photos: [] });
      buckets.get(key)!.photos.push({
        image: p.webviewPath || '',
        takenAt: typeof p.takenAt === 'number' ? p.takenAt : Date.parse(p.takenAt),
      });
    }

    const features = [...buckets.values()].map(b => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.lng, b.lat] },
      properties: {
        count: b.photos.length,
        photos: JSON.stringify(b.photos),
      },
    }));

    console.log('[Map] buildGroupedGeoJSON -> photos avec coords:',
      totalWithCoords, '| clusters:', features.length);

    return { type: 'FeatureCollection' as const, features };
  }


  private initMap() {
    const style: any = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/fonts/{fontstack}/{range}.pbf', // <- correct
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
      zoom: 4,
    }));

    map.addControl(new (maplibregl as any).NavigationControl(), 'top-right');

    map.on('load', () => {
      const data = this.buildGroupedGeoJSON();

      map.addSource(this.mapSourceId, {
        type: 'geojson',
        data: data as any,
        cluster: true,
        clusterRadius: 64,
        clusterMaxZoom: 15,
      } as any);

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: this.mapSourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#2F7CF6',
          'circle-radius': ['step', ['get', 'point_count'], 22, 10, 28, 30, 34, 100, 42],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        } as any,
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: this.mapSourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Regular'],
          'text-size': 14,
        } as any,
        paint: { 'text-color': '#ffffff' } as any,
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: this.mapSourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#FF4D6D',
          'circle-radius': 10,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        } as any,
      });

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


      this.fitOnDataOrGeolocate(data);
    });
  }


  private async fitOnDataOrGeolocate(data?: GeoJSON.FeatureCollection) {
    if (!this.map) return;

    const sourceData = data ?? (this.buildGroupedGeoJSON() as any);
    const feats = (sourceData.features || []) as any[];
    if (feats.length) {
      const bounds = new maplibregl.LngLatBounds();
      for (const f of feats) bounds.extend(f.geometry.coordinates as [number, number]);
      this.map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 600 });
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true, timeout: 5000, maximumAge: 0
        })
      );
      this.map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12, duration: 600 });
    } catch {
      this.map.easeTo({ center: [2.33, 48.86], zoom: 5, duration: 600 });
    }
  }


  private renderCarouselPopup(
    photos: Array<{ image: string; takenAt: number }>,
    count: number
  ) {
    if (!photos || !photos.length) return '<div>Aucune photo</div>';

    const main = photos[0].image || '';
    const thumbs = photos.map((p, i) => `
      <img src="${p.image}" data-idx="${i}" style="
        width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;margin-right:6px;
        border:1px solid rgba(0,0,0,.1);
      "/>`).join('');

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


  public refreshMapData() {
    if (!this.map) return;
    const src = this.map.getSource(this.mapSourceId) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const data = this.buildGroupedGeoJSON();
    src.setData(data as any);
    this.fitOnDataOrGeolocate(data);
  }


  public async centerNearMe() {
    if (!this.map) return;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true, timeout: 7000, maximumAge: 0
        })
      );
      this.map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 800 });
    } catch {}
  }
}
