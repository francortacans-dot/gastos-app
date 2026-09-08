import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/**
 * Abre el selector de archivos del sistema (o del navegador en web) y
 * devuelve el contenido del archivo elegido como texto. Devuelve null si el
 * usuario cancela. Mismo patrón que `compartirCsv` (expo-file-system +
 * expo-document-picker), pero en la dirección de lectura en vez de escritura.
 *
 * En web, expo-file-system.File no está soportado (ver ExpoFileSystem.web.ts):
 * ahí el asset trae un `File`/Blob nativo del navegador (o, si no, su base64)
 * y hay que leerlo directamente en vez de pasar por expo-file-system.
 */
export async function seleccionarArchivoCsv(): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: 'text/csv',
    copyToCacheDirectory: true,
  });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  const asset = resultado.assets[0];

  if (Platform.OS === 'web') {
    if (asset.file) return asset.file.text();
    if (asset.uri.startsWith('data:')) return atob(asset.uri.split(',')[1] ?? '');
    return null;
  }

  const archivo = new File(asset.uri);
  return archivo.textSync();
}
