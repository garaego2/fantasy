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
const fs = require('fs');
const glob = require('glob');
const csv = require('csv-parser');

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



// Get all players
app.get('/api/players', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, points, nationality, p_points FROM player');
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

// Save team route 
app.post('/api/save-team', async (req, res) => {
  const { startId, benchId, capId, teamName, userId } = req.body; 

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
          userId, 
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
        done(null, user); 
    } catch (error) {
        done(error); 
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
        done(); 
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
/*
// Serve static files from the 'public' directory
app.use(express.static('public'));
async function processAndUpsertData(client, filePattern, roundIdentifier) {
  try {
    // Use glob to find all files matching the pattern
    const filePaths = glob.sync(filePattern);

    if (filePaths.length === 0) {
      throw new Error('No files found matching the pattern.');
    }

    // Read and concatenate all CSV files into a single array
    let combinedData = [];
    for (const filePath of filePaths) {
      const data = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv({ separator: ';' }))
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error) => reject(error));
      });
      combinedData = combinedData.concat(data);
    }

    // Aggregate data by player
    const aggregatedData = combinedData.reduce((acc, row) => {
      const player = row['PLAYER'];
      if (!acc[player]) {
        acc[player] = {
          '#': row['#'], 
          GOALS: 0,
          'PF DRAWN': 0,
          SWIMOFFS: 0,
          BLOCKS: 0,
          ASSISTS: 0,
          STEALS: 0,
          'PERSONAL FOULS': 0,
          ATTEMPTS: 0,
          'OFFENSIVE FOULS': 0,
          'BALLS LOST': 0,
          SAVES: 0
        };
      }
      for (const key in acc[player]) {
        if (key !== '#') { 
          acc[player][key] += parseInt(row[key]) || 0;
        }
      }
      return acc;
    }, {});
    
    const aggregatedArray = Object.keys(aggregatedData).map(player => {
      return { PLAYER: player, ...aggregatedData[player] };
    });

    // Calculate 'Weighted_Score' and 'Points'
    aggregatedArray.forEach(row => {
      if ([1, 13].includes(parseInt(row['#']))) { 
        row.Weighted_Score = (row.GOALS * 33) + row.SAVES;
      } else {
        // General calculation for other players
        row.Weighted_Score = (
          (row.GOALS * 6) +
          2 * (row['PF DRAWN'] + row.SWIMOFFS + row.BLOCKS + row.ASSISTS + row.STEALS) -
          row['PERSONAL FOULS'] -
          row.ATTEMPTS -
          row['OFFENSIVE FOULS'] -
          row['BALLS LOST']
        );
      }
      row.Points = row.Weighted_Score;
    });

    // Fetch existing points and processed rounds from the database
    const playerPoints = await client.query('SELECT name, points, processed_rounds FROM player');

    const playerMap = playerPoints.rows.reduce((acc, player) => {
      acc[player.name] = { points: player.points || 0, processed_rounds: player.processed_rounds || [] };
      return acc;
    }, {});

    // Update the player's points in the database
    for (const row of aggregatedArray) {
      const playerName = row.PLAYER;
      const newPoints = row.Points;

      if (!playerMap[playerName].processed_rounds.includes(roundIdentifier)) {
        const totalPoints = playerMap[playerName].points + newPoints;

        await client.query(
          'UPDATE player SET points = $1, processed_rounds = processed_rounds || $2::jsonb WHERE name = $3',
          [totalPoints, JSON.stringify([roundIdentifier]), playerName]
        );
      }
    }

    return aggregatedArray;
  } catch (error) {
    console.error('Error processing data:', error);
    throw error;
  }
}

module.exports = processAndUpsertData;
app.get('/process-data', (req, res) => {
  pool.connect((err, client, done) => {
    if (err) {
      console.error('Error connecting to PostgreSQL database', err);
      res.status(500).json({ error: 'Error connecting to database' });
    } else {
      const filePattern = '/Users/egor/Downloads/player_stats_*.csv';  // Pattern to match all CSV files

      processAndUpsertData(client, filePattern, roundIdentifier)
        .then((aggregatedData) => {
          done();
          res.status(200).json({
            message: 'Data processed and upserted successfully.',
            data: aggregatedData.slice(0, 5)  // Return a sample of the data
          });
        })
        .catch((error) => {
          done();
          console.error('Error processing data', error);
          res.status(500).json({ error: 'Error processing data' });
        });
    }
  });
});
*/

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

