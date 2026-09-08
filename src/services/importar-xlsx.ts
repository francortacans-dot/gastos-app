import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Igual que seleccionarArchivoCsv (src/services/importar-csv.ts) pero para
 * .xlsx: el picker filtra por el mime type del formato y el archivo se lee
 * como bytes (arrayBuffer) en vez de texto, porque un xlsx es binario.
 * Devuelve null si el usuario cancela.
 */
export async function seleccionarArchivoXlsx(): Promise<Uint8Array | null> {
  const resultado = await DocumentPicker.getDocumentAsync({
    type: MIME_TYPE,
    copyToCacheDirectory: true,
  });

  if (resultado.canceled || resultado.assets.length === 0) {
    return null;
  }

  const archivo = new File(resultado.assets[0].uri);
  const buffer = await archivo.arrayBuffer();
  return new Uint8Array(buffer);
}
