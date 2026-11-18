import { ShowAlert } from '../hooks/useConsoleAlert';

interface ImportSummary {
  kind: string; // "ritmo(s)" / "sonido(s)"
  formats: string; // formatos aceptados, para el mensaje de error
  imported: number;
  category: string;
  rejected: number;
  duplicates: number;
  failed: number;
}

/** Un solo aviso que resume la importación (agregados, repetidos, rechazados y fallidos) */
export function reportImport(showAlert: ShowAlert, s: ImportSummary) {
  const notes: string[] = [];
  if (s.duplicates > 0) notes.push(`${s.duplicates} ya estaba(n) importado(s) y se omitieron.`);
  if (s.rejected > 0) notes.push(`${s.rejected} no tenía(n) formato ${s.formats}.`);
  if (s.failed > 0) notes.push(`${s.failed} no se pudo(pudieron) copiar al teléfono.`);
  const extra = notes.length ? `\n\n${notes.join('\n')}` : '';

  if (s.imported > 0) {
    showAlert(
      notes.length ? 'WARNING' : 'SUCCESS',
      'IMPORTACIÓN COMPLETA',
      `Se agregaron ${s.imported} ${s.kind} a la categoría ${s.category}. Quedan guardados en el teléfono.${extra}`
    );
  } else if (notes.length) {
    showAlert(s.failed > 0 || s.rejected > 0 ? 'ERROR' : 'INFO', 'NO SE IMPORTÓ NADA', notes.join('\n'));
  }
}
