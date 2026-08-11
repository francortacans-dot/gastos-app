import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const NOMBRE_ARCHIVO = 'portfolio.csv';

/**
 * En web/escritorio dispara la descarga del navegador. En celular escribe el
 * archivo en cache y abre el share sheet nativo (WhatsApp, Drive, Mail, etc.).
 */
export async function compartirCsv(csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = NOMBRE_ARCHIVO;
    enlace.click();
    URL.revokeObjectURL(url);
    return;
  }

  const archivo = new File(Paths.cache, NOMBRE_ARCHIVO);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(csv);

  const disponible = await Sharing.isAvailableAsync();
  if (disponible) {
    await Sharing.shareAsync(archivo.uri, { mimeType: 'text/csv', dialogTitle: 'Compartir portfolio' });
  }
}
