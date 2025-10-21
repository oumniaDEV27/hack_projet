import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Geolocation } from '@capacitor/geolocation';

const PHOTO_STORAGE_KEY = 'photos-v1';

export interface SavedPhoto {
  filepath: string;                         
  webviewPath?: string;                      
  takenAt: string;                           
  coords?: { lat: number; lng: number; accuracy?: number };
  liked?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private _photos: SavedPhoto[] = [];
  get photos() { return this._photos; }


  async loadSaved(): Promise<void> {
    const { value } = await Preferences.get({ key: PHOTO_STORAGE_KEY });
    this._photos = value ? JSON.parse(value) : [];


    this._photos.sort((a, b) => +new Date(b.takenAt) - +new Date(a.takenAt));
  }


  async addNewToGallery(): Promise<SavedPhoto | undefined> {
    try {
      const captured = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl, 
        source: CameraSource.Camera,
        quality: 80,
        saveToGallery: false,
        correctOrientation: true,
      });

      if (!captured.dataUrl) return undefined;
      return this.saveFromDataUrl(captured.dataUrl);
    } catch {

      return undefined;
    }
  }


  async saveFromDataUrl(dataUrl: string): Promise<SavedPhoto> {
    const coords = await this.getCoords();  

    const fileName = `${Date.now()}.jpeg`;
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl; 


    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Data,
    });

    const newPhoto: SavedPhoto = {
      filepath: fileName,
      webviewPath: dataUrl,   
      takenAt: new Date().toISOString(),
      coords: coords || undefined,
      liked: false,
    };

    this._photos = [newPhoto, ...this._photos];
    await Preferences.set({ key: PHOTO_STORAGE_KEY, value: JSON.stringify(this._photos) });
    return newPhoto;
  }


  async toggleLike(i: number) {
    this._photos[i].liked = !this._photos[i].liked;
    await Preferences.set({ key: PHOTO_STORAGE_KEY, value: JSON.stringify(this._photos) });
  }


  async removeAt(i: number) {
    const p = this._photos[i];
    try {
      await Filesystem.deleteFile({ directory: Directory.Data, path: p.filepath });
    } catch {

    }
    this._photos.splice(i, 1);
    await Preferences.set({ key: PHOTO_STORAGE_KEY, value: JSON.stringify(this._photos) });
  }


  private async getCoords(): Promise<{ lat: number; lng: number; accuracy?: number } | null> {

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

        console.warn('[PhotoService] Web geolocation failed:', e);
      }
    }


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
