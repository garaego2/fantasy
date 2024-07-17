const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors());

// PostgreSQL client setup
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'players',
    password: process.env.DB_PASSWORD || 'Sinitiaisenpolku1',
    port: process.env.DB_PORT || 5432,
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
app.use(bodyParser.json());

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
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
            [username, hashedPassword]
        );
        const user = result.rows[0];
        res.status(201).json({ id: user.id, username: user.username });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Middleware for Protected Routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Protected Route Example
app.get('/profile', authenticateToken, async (req, res) => {
    const { id } = req.user;
    try {
        const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Error fetching user' });
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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
