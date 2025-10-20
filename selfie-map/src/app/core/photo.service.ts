import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';

const PHOTO_STORAGE_KEY = 'photos-v1';

export interface SavedPhoto {
  filepath: string;                          // nom du fichier dans Filesystem
  webviewPath?: string;                      // dataURL (ou chemin web) pour l’affichage immédiat
  takenAt: string;                           // ISO string
  coords?: { lat: number; lng: number; accuracy?: number };
  liked?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private _photos: SavedPhoto[] = [];
  get photos() { return this._photos; }

  /** Charge depuis Preferences */
  async loadSaved(): Promise<void> {
    const { value } = await Preferences.get({ key: PHOTO_STORAGE_KEY });
    this._photos = value ? JSON.parse(value) : [];

    // (optionnel) tri décroissant par date si besoin
    this._photos.sort((a, b) => +new Date(b.takenAt) - +new Date(a.takenAt));
  }

  /** [Mobile / plus tard] – prise via Capacitor Camera directement */
  async addNewToGallery(): Promise<SavedPhoto | undefined> {
    try {
      const captured = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl, // on reste en dataURL pour l’instant (simple & portable web)
        source: CameraSource.Camera,
        quality: 80,
        saveToGallery: false,
        correctOrientation: true,
      });

      if (!captured.dataUrl) return undefined;
      return this.saveFromDataUrl(captured.dataUrl);
    } catch {
      // utilisateur a annulé, ou permission refusée
      return undefined;
    }
  }

  /**
   * 🔥 Méthode utilisée par la webcam web (canvas.toDataURL)
   * - récupère (si possible) la géoloc
   * - enregistre l’image en base64 dans Filesystem (Data dir)
   * - persiste la liste dans Preferences
   */
  async saveFromDataUrl(dataUrl: string): Promise<SavedPhoto> {
    const coords = await this.getCoords();   // tente de récupérer la position (ou null si refus/erreur)

    const fileName = `${Date.now()}.jpeg`;
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl; // sécurise

    // Sur le web, Filesystem utilise IndexedDB: ça fonctionne, aucun chemin physique nécessaire
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Data,
    });

    const newPhoto: SavedPhoto = {
      filepath: fileName,
      webviewPath: dataUrl,                  // affiche instantanément sans relire le fichier
      takenAt: new Date().toISOString(),
      coords: coords || undefined,
      liked: false,
    };

    this._photos = [newPhoto, ...this._photos];
    await Preferences.set({ key: PHOTO_STORAGE_KEY, value: JSON.stringify(this._photos) });
    return newPhoto;
  }

  /** Like / Unlike */
  async toggleLike(i: number) {
    this._photos[i].liked = !this._photos[i].liked;
    await Preferences.set({ key: PHOTO_STORAGE_KEY, value: JSON.stringify(this._photos) });
  }

  /** Suppression (fichier + liste) */
  async removeAt(i: number) {
    const p = this._photos[i];
    try {
      await Filesystem.deleteFile({ directory: Directory.Data, path: p.filepath });
    } catch {
      // ignore si le fichier n’existe pas (web / ancien format…)
    }
    this._photos.splice(i, 1);
    await Preferences.set({ key: PHOTO_STORAGE_KEY, value: JSON.stringify(this._photos) });
  }

  // ===================== Géolocalisation (robuste) =====================

  /**
   * Essaie d’abord l’API navigateur, puis Capacitor en fallback.
   * Retourne {lat, lng, accuracy?} ou null si refus/erreur.
   */
  private async getCoords(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {
    // 1) API web native (meilleure UX sur desktop, permission par site)
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        };
      } catch (e) {
        // refus / timeout → on tentera Capacitor ensuite
        console.warn('[PhotoService] Web geolocation failed:', e);
      }
    }

    // 2) Fallback Capacitor (utile sur mobile / PWA)
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      };
    } catch (e) {
      console.warn('[PhotoService] Capacitor geolocation failed:', e);
      return null;
    }
  }
}
