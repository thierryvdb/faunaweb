import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export async function capturePhoto() {
  const photo = await Camera.getPhoto({
    quality: 70,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera
  });
  return photo.dataUrl ?? null;
}
