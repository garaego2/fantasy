const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());

const pool = new Pool({
    user: 'postgres', // replace with your PostgreSQL username
    host: 'localhost', // replace with your PostgreSQL host, usually 'localhost'
    database: 'players', // replace with your database name
    password: 'Sinitiaisenpolku1', // replace with your PostgreSQL password
    port: 5432, // default port for PostgreSQL
});

app.get('/api/players', async (req, res) => {
  try {
      // Query the database to get player names and points
      const result = await pool.query('SELECT name, points, nationality FROM player');
      res.json(result.rows); // Send the results as JSON
  } catch (error) {
      console.error('Error fetching players:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});