import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, GradeRecord, Institution, Parcial, Subject, Submission, User } from '../types';
import { fmtDate } from './db';

export interface StudentHistoryPDFParams {
  student: User;
  exams: Exam[];
  submissions: Submission[];
  gradeRecords: GradeRecord[];
  subjects: Subject[];
  parciales: Parcial[];
  overallAvg: number;
  institution?: Institution | null;
}

function getLastTableY(doc: jsPDF, fallbackY: number): number {
  const internalDoc = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return internalDoc.lastAutoTable?.finalY ?? fallbackY;
}

function sanitizeFilePart(value: string): string {
  return (value || 'Estudiante')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'Estudiante';
}

export function generateStudentHistoryPDF({
  student,
  exams,
  submissions,
  gradeRecords,
  subjects,
  parciales,
  overallAvg,
  institution,
}: StudentHistoryPDFParams): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const instName = institution?.nombre?.trim() || 'SYNAPSIS ERP · GESTIÓN ACADÉMICA';
  const generatedDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  // 1. HEADER BANNER
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 30, 'F');

  doc.setFillColor(6, 182, 212); // Cyan 500 accent bar
  doc.rect(0, 30, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(instName.toUpperCase(), margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(186, 230, 253);
  doc.text('REPORTE RESUMIDO DE HISTORIAL ACADÉMICO Y CALIFICACIONES', margin, 19.5);

  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido: ${generatedDate}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(`Escala: 0.0 - 5.0`, pageWidth - margin, 19.5, { align: 'right' });

  // 2. STUDENT PROFILE & KPI SUMMARY BOX
  let cursorY = 38;
  const studentCode = student.codigo || student.id.substring(0, 6).toUpperCase();
  const resolvedSubjects = (student.asignaturas || []).map((asgId) => {
    const found = subjects.find(
      (s) =>
        s.id === asgId ||
        (s.nombre || '').toLowerCase().trim() === asgId.toLowerCase().trim()
    );
    return found ? found.nombre : asgId;
  });

  const subjectsLabel =
    resolvedSubjects.length > 0 ? resolvedSubjects.join(', ') : 'Sin materias asignadas';
  const wrappedSubjects = doc.splitTextToSize(`Materias: ${subjectsLabel}`, contentWidth - 62);
  const profileBoxHeight = Math.max(30, 22 + wrappedSubjects.length * 4.2);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cursorY, contentWidth, profileBoxHeight, 2.5, 2.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(student.nombre || 'Estudiante', margin + 4, cursorY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Correo: ${student.email || '—'}   ·   Cédula: ${student.cedula || 'No registrada'}`,
    margin + 4,
    cursorY + 13
  );
  doc.text(
    `Código: ${studentCode}   ·   Semestre: ${student.semestre || 'General'}`,
    margin + 4,
    cursorY + 18
  );
  doc.text(wrappedSubjects, margin + 4, cursorY + 23.5);

  // KPI Card on the right side of profile box
  const kpiW = 50;
  const kpiX = pageWidth - margin - kpiW - 3;
  const kpiY = cursorY + 3;
  const kpiH = profileBoxHeight - 6;

  doc.setFillColor(238, 242, 255); // Indigo 50
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(kpiX, kpiY, kpiW, kpiH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(79, 70, 229);
  doc.text('PROMEDIO GENERAL', kpiX + kpiW / 2, kpiY + 5.5, { align: 'center' });

  doc.setFontSize(17);
  doc.setTextColor(49, 46, 129);
  doc.text(overallAvg > 0 ? overallAvg.toFixed(1) : '—', kpiX + kpiW / 2, kpiY + 13.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${submissions.length} exám. · ${gradeRecords.length} notas`,
    kpiX + kpiW / 2,
    kpiY + kpiH - 3,
    { align: 'center' }
  );

  cursorY += profileBoxHeight + 8;

  // 3. SECTION 1: EVALUACIONES PRESENTADAS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`1. Evaluaciones Presentadas (${submissions.length})`, margin, cursorY);
  cursorY += 3;

  if (submissions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No registra evaluaciones presentadas.', margin, cursorY + 5);
    cursorY += 12;
  } else {
    const examRows = submissions.map((sub) => {
      const ex = exams.find((e) => e.id === sub.examenId);
      const isPend = sub.estado === 'pendiente';
      const nota5 = ((Number(sub.puntaje) || 0) / 20).toFixed(2);
      const statusText = isPend ? 'Pendiente' : sub.aprobado ? 'Aprobado' : 'Reprobado';
      return [
        ex?.titulo || 'Evaluación',
        ex?.materia || '—',
        fmtDate(sub.fecha),
        sub.tiempoUsado || '—',
        `${sub.puntaje}%`,
        nota5,
        statusText,
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Evaluación', 'Asignatura', 'Fecha', 'Tiempo', 'Puntaje', 'Nota (5.0)', 'Estado']],
      body: examRows,
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = String(data.cell.raw || '');
          if (val === 'Aprobado') data.cell.styles.textColor = [5, 150, 105];
          else if (val === 'Reprobado') data.cell.styles.textColor = [225, 29, 72];
          else data.cell.styles.textColor = [217, 119, 6];
        }
      },
    });

    cursorY = getLastTableY(doc, cursorY + 20) + 9;
  }

  // 4. SECTION 2: CALIFICACIONES MANUALES
  if (cursorY > pageHeight - 40) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. Calificaciones Manuales y Actas (${gradeRecords.length})`, margin, cursorY);
  cursorY += 3;

  if (gradeRecords.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No registra calificaciones manuales.', margin, cursorY + 5);
  } else {
    const gradeRows = gradeRecords.map((grade) => {
      const subj = subjects.find((s) => s.id === grade.asignaturaId);
      const parc = parciales.find((p) => p.id === grade.parcialId);
      const hasBreakdown =
        grade.notaEV1 != null || grade.notaEV2 != null || grade.notaTrabajo != null;
      const breakdown = hasBreakdown
        ? `${(Number(grade.notaEV1) || 0).toFixed(1)} / ${(Number(grade.notaEV2) || 0).toFixed(1)} / ${(Number(grade.notaTrabajo) || 0).toFixed(1)}`
        : '—';

      return [
        subj?.nombre || 'Asignatura',
        parc?.nombre || 'Parcial',
        breakdown,
        (Number(grade.nota) || 0).toFixed(2),
        grade.aprobado ? 'Aprobado' : 'Reprobado',
        grade.comentario?.trim() || fmtDate(grade.creado),
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Asignatura', 'Parcial', 'EV1 / EV2 / Trab.', 'Nota', 'Estado', 'Observación / Fecha']],
      body: gradeRows,
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [15, 118, 110], // Teal 700
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = String(data.cell.raw || '');
          data.cell.styles.textColor = val === 'Aprobado' ? [5, 150, 105] : [225, 29, 72];
        }
      },
    });
  }

  // 5. PAGE FOOTERS
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Synapsis ERP · Reporte resumido generado automáticamente',
      margin,
      pageHeight - 8
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    });
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `Historial_Notas_${sanitizeFilePart(student.nombre)}_${dateSlug}.pdf`;
  doc.save(fileName);
  return fileName;
}
