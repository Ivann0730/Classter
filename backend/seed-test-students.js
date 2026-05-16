const db = require('./database');

// Seed 40 test students
console.log('Seeding 40 test students...');

const insertStudent = db.prepare(
  'INSERT OR REPLACE INTO students (student_id, name, wallet_address) VALUES (?, ?, ?)'
);

for (let i = 1; i <= 40; i++) {
  const studentId = `2021-${String(i).padStart(4, '0')}`;
  const name = `Test Student ${i}`;

  insertStudent.run(studentId, name, null);
}

console.log('✓ 40 students seeded successfully');
console.log('Student IDs: 2021-0001 to 2021-0040');

// Show all students
const students = db.prepare('SELECT * FROM students').all();

console.log(`Total students in DB: ${students.length}`);
