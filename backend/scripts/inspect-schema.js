"use strict";
require("dotenv").config();
const pool = require("../src/config/db");

async function check() {
  const [cols] = await pool.execute("DESCRIBE users");
  console.log(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Default: c.Default })));
  
  const [admins] = await pool.execute("SELECT id, name, email, role, status FROM users WHERE role = 'admin'");
  console.log("Existing admins:", admins);

  await pool.end();
}
check().catch(console.error);
