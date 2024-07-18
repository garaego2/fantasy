const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const passport = require('passport');

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

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure express-session to use session store
app.use(session({
    store: new pgSession({
        pool: pool, // Use the same pool as your PostgreSQL connection
        tableName: 'sessions'
    }),
    secret: 'your_secret_key', // Replace with a secure random string
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set secure: true if using HTTPS
}));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

// Middleware to authenticate the user and set req.user
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.status(401).json({ success: false, message: 'User not authenticated' });
    }
}

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

// Route for user login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password)) {
            req.login(user, (err) => {
                if (err) {
                    console.error('Error during login:', err);
                    return res.status(500).send('Internal server error');
                }

                const token = jwt.sign({ id: user.user_id, username: user.username }, 'your_jwt_secret', { expiresIn: '1h' });
                res.json({ token, userId: user.user_id, username });
            });
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal server error');
    }
});

// Save team route (requires authentication)
// Example of removing authentication requirement for /api/save-team
app.post('/api/save-team', async (req, res) => {
  const { startId, benchId, capId, teamName, userId } = req.body; // Ensure userId is passed from client

  try {
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

      const result = await pool.query(query, [
          userId, // Use userId passed from client
          JSON.stringify(startId),
          JSON.stringify(benchId),
          capId,
          teamName
      ]);

      res.json({ success: true, teamId: result.rows[0].id });
  } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ success: false, error: 'Failed to save team' });
  }
});


const LocalStrategy = require('passport-local').Strategy;

// Configure Passport to use LocalStrategy for username/password authentication
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
            const user = result.rows[0];

            if (!user) {
                return done(null, false, { message: 'Incorrect username.' });
            }

            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }

            return done(null, user); // Return the user object if authentication succeeds
        } catch (error) {
            return done(error); // Pass any database errors to done
        }
    }
));

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.user_id); // Serialize the user's id to the session
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
        const user = result.rows[0];
        done(null, user); // Deserialize the user object
    } catch (error) {
        done(error); // Pass any database errors to done
    }
});

// Route to render leaderboard
app.get('/leaderboard-data', (req, res) => {
  pool.connect((err, client, done) => {
    if (err) {
      console.error('Error connecting to PostgreSQL database', err);
      res.status(500).json({ error: 'Error connecting to database' });
    } else {
      client.query('SELECT team_name, points FROM user_teams ORDER BY points DESC', (err, result) => {
        done(); // Release client back to the pool
        if (err) {
          console.error('Error executing query', err);
          res.status(500).json({ error: 'Error fetching data' });
        } else {
          const leaderboardData = result.rows;
          res.json({ leaderboardData });
        }
      });
    }
  });
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

