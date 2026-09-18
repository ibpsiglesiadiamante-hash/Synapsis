const fs = require('fs');
const path = require('path');

const semParcPath = path.join(__dirname, '..', 'src', 'data', 'backupSemestersParciales.json');
const semParc = JSON.parse(fs.readFileSync(semParcPath, 'utf8'));

// The 8 key parciales for the 8 exams from user's backup:
const requiredParciales = [
  {
    id: "1a07edfc2bc_55efa6b6",
    nombre: "EVALUACION I",
    materia: "INTRODUCCION ANTIGUO TESTAMENTO",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del primer corte para Introducción Antiguo Testamento",
    creado: "2026-09-08T02:49:17.382Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07f7e962d_c11ee027",
    nombre: "EVALUACION II",
    materia: "INTRODUCCION ANTIGUO TESTAMENTO",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del segundo corte para Introducción Antiguo Testamento",
    creado: "2026-09-08T03:32:00.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07ee1b882_6eabc7da",
    nombre: "EVALUACION I",
    materia: "GEOGRAFIA BIBLICA",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del primer corte para Geografía Bíblica",
    creado: "2026-09-08T02:51:24.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07ee20111_5e0858b0",
    nombre: "EVALUACION II",
    materia: "GEOGRAFIA BIBLICA",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del segundo corte para Geografía Bíblica",
    creado: "2026-09-08T02:51:30.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07eeeb300_be417f68",
    nombre: "EVALUACION I",
    materia: "APOCALIPSIS I",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del primer corte para Apocalipsis I",
    creado: "2026-09-08T02:56:00.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07eef2a68_87c428e5",
    nombre: "EVALUACION II",
    materia: "APOCALIPSIS I",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del segundo corte para Apocalipsis I",
    creado: "2026-09-08T02:56:15.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07ef00ed7_85da3677",
    nombre: "EVALUACION I",
    materia: "PROFETAS MAYORES I",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del primer corte para Profetas Mayores I",
    creado: "2026-09-08T02:56:45.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  },
  {
    id: "1a07ef05d1f_8313e6ff",
    nombre: "EVALUACION II",
    materia: "PROFETAS MAYORES I",
    semestre: "SEMESTRE I",
    descripcion: "Evaluación del segundo corte para Profetas Mayores I",
    creado: "2026-09-08T02:56:55.000Z",
    actualizado: "2026-09-17T03:30:00.000Z"
  }
];

const existingParcIds = new Set(semParc.parciales.map(p => p.id));
let added = 0;
for (const p of requiredParciales) {
  if (!existingParcIds.has(p.id)) {
    semParc.parciales.push(p);
    existingParcIds.add(p.id);
    added++;
  } else {
    // update if needed
    const idx = semParc.parciales.findIndex(x => x.id === p.id);
    if (idx >= 0) {
      semParc.parciales[idx] = { ...semParc.parciales[idx], ...p };
    }
  }
}

fs.writeFileSync(semParcPath, JSON.stringify(semParc, null, 2), 'utf8');
console.log(`Added/Updated ${added} required parciales. Total parciales: ${semParc.parciales.length}`);
