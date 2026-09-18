const fs = require('fs');
const path = require('path');

// Read existing backupExams.json if needed
const examsFilePath = path.join(__dirname, '..', 'src', 'data', 'backupExams.json');
let existing = { exams: [] };
try {
  existing = JSON.parse(fs.readFileSync(examsFilePath, 'utf8'));
} catch (e) {}

// Define exams in structured chunks to avoid payload truncation
console.log('Script initialized');
