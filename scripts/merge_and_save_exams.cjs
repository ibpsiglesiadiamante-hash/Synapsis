const fs = require('fs');
const path = require('path');

const exams1_4 = require('./exam1_4.cjs');
const exams5_8 = require('./exam5_8.cjs');

const allExams = [...exams1_4, ...exams5_8];

console.log(`Total exams assembled: ${allExams.length}`);
allExams.forEach((e, idx) => {
  console.log(`${idx + 1}. [${e.id}] ${e.titulo.replace(/\n/g, ' ')} (${e.preguntas.length} preguntas, parcial: ${e.parcialId})`);
});

const outputPath = path.join(__dirname, '..', 'src', 'data', 'backupExams.json');
fs.writeFileSync(outputPath, JSON.stringify({ exams: allExams }, null, 2), 'utf8');
console.log(`Saved successfully to ${outputPath}`);
