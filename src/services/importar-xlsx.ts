import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function bytesDesdeBase64(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * Igual que seleccionarArchivoCsv (src/services/importar-csv.ts) pero para
 * .xlsx: el picker filtra por el mime type del formato y el archivo se lee
 * como bytes en vez de texto, porque un xlsx es binario. Devuelve null si el
 * usuario cancela.
 *
 * En web, expo-file-system.File no está soportado (ver ExpoFileSystem.web.ts):
 * ahí el asset trae un `File`/Blob nativo del navegador (o, si no, su base64)
 * y hay que leerlo directamente en vez de pasar por expo-file-system.
 */
export async function seleccionarArchivoXlsx(): Promise<Uint8Array | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: MIME_TYPE,
    copyToCacheDirectory: true,
  });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  const asset = resultado.assets[0];

  if (Platform.OS === 'web') {
    if (asset.file) {
      const buffer = await asset.file.arrayBuffer();
      return new Uint8Array(buffer);
    }
    if (asset.uri.startsWith('data:')) {
      return bytesDesdeBase64(asset.uri.split(',')[1] ?? '');
    }
    return null;
  }

  const archivo = new File(asset.uri);
  const buffer = await archivo.arrayBuffer();
  return new Uint8Array(buffer);
}
