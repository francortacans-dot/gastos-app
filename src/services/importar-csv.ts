import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

/**
 * Abre el selector de archivos del sistema (o del navegador en web) y
 * devuelve el contenido del archivo elegido como texto. Devuelve null si el
 * usuario cancela. Mismo patrón que `compartirCsv` (expo-file-system +
 * expo-document-picker), pero en la dirección de lectura en vez de escritura.
 */
export async function seleccionarArchivoCsv(): Promise<string | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: 'text/csv',
    copyToCacheDirectory: true,
  });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  const archivo = new File(resultado.assets[0].uri);
  return archivo.textSync();
}
