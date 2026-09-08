import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const NOMBRE_ARCHIVO = 'portfolio.xlsx';
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Igual que compartirCsv (src/services/compartir-csv.ts) pero recibe el
 * contenido del xlsx ya codificado en base64: en web decodifica a bytes
 * para armar el Blob de descarga; en nativo escribe el archivo con
 * encoding 'base64' en vez de texto plano.
 */
export async function compartirXlsx(base64: string): Promise<void> {
  if (Platform.OS === 'web') {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const blob = new Blob([bytes], { type: MIME_TYPE });
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
  archivo.write(base64, { encoding: 'base64' });

  const disponible = await Sharing.isAvailableAsync();
  if (disponible) {
    await Sharing.shareAsync(archivo.uri, { mimeType: MIME_TYPE, dialogTitle: 'Compartir portfolio' });
  }
}
