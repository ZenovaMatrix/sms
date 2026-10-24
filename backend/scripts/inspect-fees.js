"use strict";
const pool = require('../src/config/db');
(async () => {
  // Check existing fee_types in database
  const [ft] = await pool.execute('SELECT DISTINCT fee_type FROM fee_structures');
  console.log('Actual fee types:', JSON.stringify(ft));

  // Check section filter potential for student fees
  const [sf] = await pool.execute(`
    SELECT sf.id, sf.status, sf.amount_due, sf.amount_paid, sf.balance, s.first_name, s.last_name, s.student_id as admission_no,
           fs.fee_type, fs.amount, fs.due_date, ay.year_name,
           c.class_name, e.section_id, sec.section_name
    FROM student_fees sf
    JOIN students s ON s.id = sf.student_id
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    JOIN academic_years ay ON ay.id = fs.academic_year_id
    JOIN classes c ON c.id = fs.class_id
    LEFT JOIN enrollments e ON e.student_id = sf.student_id AND e.class_id = fs.class_id AND e.academic_year_id = fs.academic_year_id
    LEFT JOIN sections sec ON sec.id = e.section_id
    LIMIT 5
  `);
  console.log('Student fees with class/section:',
    JSON.stringify(sf.map(r => ({
      name: r.first_name + ' ' + r.last_name,
      fee_type: r.fee_type, amount: r.amount, due_date: r.due_date,
      year: r.year_name, class: r.class_name, section: r.section_name, status: r.status,
      amount_due: r.amount_due, amount_paid: r.amount_paid, balance: r.balance
    })), null, 2)
  );

  // Financial summary
  const [fin] = await pool.execute(`
    SELECT 
      SUM(amount_due) as total_billed,
      SUM(amount_paid) as total_collected,
      SUM(balance) as total_outstanding
    FROM student_fees
  `);
  console.log('Financial summary:', JSON.stringify(fin[0]));

  // Check parents with linked students
  const [pg] = await pool.execute(`
    SELECT p.full_name, p.email, p.phone, p.occupation,
           COUNT(sp.id) as linked_students
    FROM parents_guardians p
    LEFT JOIN student_parents sp ON sp.parent_id = p.id
    GROUP BY p.id
    LIMIT 5
  `);
  console.log('Parents:', JSON.stringify(pg));

  pool.end();
})();
