const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/compute.db');

db.run('DELETE FROM fah_verifications WHERE fah_username = ?', ['Anonymous'], function(err) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Deleted', this.changes, 'verification(s) for Anonymous');
  }
  db.close();
});
