const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/compute.db');

db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Tables:', tables);
  }
  
  db.all("SELECT * FROM fah_verification LIMIT 5", [], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      console.log('Verifications:', JSON.stringify(rows, null, 2));
    }
    db.close();
  });
});
