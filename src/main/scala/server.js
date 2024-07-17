const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

// PostgreSQL client setup
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'players',
    password: process.env.DB_PASSWORD || 'Sinitiaisenpolku1',
    port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all players
app.get('/api/players', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, points, nationality FROM player');
        res.json(result.rows); // Send the results as JSON
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register Route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).send('Username and password are required.');
  }

  try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      await pool.query(
          'INSERT INTO users (username, password) VALUES ($1, $2)',
          [username, hashedPassword]
      );
      res.status(201).send('User registered successfully.');
  } catch (error) {
      console.error('Error registering user:', error);
      res.status(400).send('Error registering user. Username might be taken.');
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).send('Username and password are required.');
  }

  try {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];

      if (user && await bcrypt.compare(password, user.password)) {
          const token = jwt.sign({ id: user.user_id, username: user.username }, 'your_jwt_secret', { expiresIn: '1h' });
          res.json({ token });
      } else {
          res.status(401).send('Invalid credentials');
      }
  } catch (error) {
      console.error('Error during login:', error);
      res.status(500).send('Internal server error');
  }
});

app.post('/api/save-team', async (req, res) => {
  const { userId, teamName, startId, benchId, capId } = req.body;

  try {
      // Use INSERT ... ON CONFLICT to update if user_id already exists
      const query = `
          INSERT INTO user_teams (user_id, start_id, bench_id, cap_id, team_name)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (user_id) DO UPDATE
          SET
              team_name = EXCLUDED.team_name,
              start_id = EXCLUDED.start_id,
              bench_id = EXCLUDED.bench_id,
              cap_id = EXCLUDED.cap_id
          RETURNING id;
      `;

      // Execute the query
      const result = await pool.query(query, [
          userId,
          JSON.stringify(startId),
          JSON.stringify(benchId),
          capId,
          teamName
      ]);

      // Return success response with team ID
      res.json({ success: true, teamId: result.rows[0].id });
  } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ success: false, error: 'Failed to save team' });
  }
});

app.get('/api/user-team', authenticateToken, async (req, res) => {
  try {
      const userId = req.user.id; // Extract user ID from token
      const result = await pool.query(
          `SELECT starting_lineup, bench, captain_id
           FROM teams
           WHERE user_id = $1`,
          [userId]
      );

      if (result.rows.length > 0) {
          res.json(result.rows[0]);
      } else {
          res.status(404).send('No team found for user');
      }
  } catch (error) {
      console.error('Error fetching team data:', error);
      res.status(500).send('Error fetching team data');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
