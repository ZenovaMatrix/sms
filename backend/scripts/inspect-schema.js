"use strict";

const pool = require("../src/config/db");

async function inspect() {
  try {
    const [tables] = await pool.query(`SHOW TABLES`);
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableKey]);
    console.log('--- ALL TABLES ---');
    console.log(JSON.stringify(tableNames));

    console.log('\n--- ROW COUNTS ---');
    for (const name of tableNames) {
      const [countRes] = await pool.query(`SELECT COUNT(*) as count FROM \`${name}\``);
      console.log(`${name}: ${countRes[0].count}`);
    }

    console.log('\n--- SCHEMAS ---');
    for (const name of tableNames) {
      const [createRes] = await pool.query(`SHOW CREATE TABLE \`${name}\``);
      console.log(`\n/* ================= ${name} ================= */`);
      console.log(createRes[0]['Create Table']);
    }

    process.exit(0);
  } catch (err) {
    console.error('Inspection error:', err);
    process.exit(1);
  }
}

inspect();
