import { getGoogleAccessToken } from '../lib/supabase';

export interface SelectedPickerFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGapiScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (window.gapi && window.google?.picker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.gapi) {
        window.gapi.load('picker', {
          callback: () => resolve(),
          onerror: () => reject(new Error('Không thể khởi tạo Google Picker library.')),
        });
      } else {
        reject(new Error('Google API Script chưa tải thành công.'));
      }
    };
    script.onerror = () => reject(new Error('Không thể tải Google API Script.'));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export async function openGoogleDrivePicker(): Promise<SelectedPickerFile | null> {
  await loadGapiScript();

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    throw new Error('Phiên làm việc Google đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const appId = clientId.split('-')[0] || '';

  return new Promise((resolve, reject) => {
    try {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMimeTypes(
          'video/mp4,video/webm,video/quicktime,video/x-matroska,video/avi,audio/mpeg,audio/mp4,audio/wav,audio/flac,audio/ogg,audio/webm'
        );

      const builder = new window.google.picker.PickerBuilder()
        .addView(view)
        .addView(new window.google.picker.DocsUploadView())
        .setOAuthToken(accessToken)
        .setCallback((data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            if (doc) {
              resolve({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType || 'video/mp4',
                sizeBytes: doc.sizeBytes ? Number(doc.sizeBytes) : undefined,
              });
            } else {
              resolve(null);
            }
          } else if (data.action === window.google.picker.Action.CANCEL) {
            resolve(null);
          }
        });

      if (appId) {
        builder.setAppId(appId);
      }

      const picker = builder.build();
      picker.setVisible(true);
    } catch (error) {
      console.error('Failed to open Google Drive Picker:', error);
      reject(new Error('Không thể mở cửa sổ Google Drive. Vui lòng kiểm tra lại kết nối.'));
    }
  });
}
