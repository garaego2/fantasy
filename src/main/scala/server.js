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
    user: 'players_owner',
    host: 'ep-orange-tooth-a2q7flpt.eu-central-1.aws.neon.tech',
    database: 'players',
    password: 'IlHmQxjZo73A',
    port: '5432',
    ssl: 'require'
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure express-session to use session store
app.use(session({
    store: new pgSession({
        pool: pool, 
        tableName: 'sessions'
    }),
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } 
}));

app.use(passport.initialize());
app.use(passport.session());



// Get all players
app.get('/api/players', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, points, nationality, p_points FROM player');
        res.json(result.rows); 
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
      const currentTime = new Date();
      const roundQuery = `
          SELECT round_id
          FROM rounds
          WHERE start_date <= $1 AND end_date >= $1
          LIMIT 1;
      `;
      const roundResult = await pool.query(roundQuery, [currentTime.toISOString()]);
      const currentRoundId = roundResult.rows[0]?.round_id;

      if (!currentRoundId) {
          return res.status(400).json({ success: false, error: 'No current round found' });
      }
      const teamQuery = `
          SELECT id
          FROM user_teams
          WHERE user_id = $1 AND round_id = $2;
      `;
      const teamResult = await pool.query(teamQuery, [userId, currentRoundId]);

      if (teamResult.rows.length > 0) {
          const updateQuery = `
              UPDATE user_teams
              SET start_id = $1, bench_id = $2, cap_id = $3, team_name = $4
              WHERE user_id = $5 AND round_id = $6
              RETURNING id;
          `;
          const result = await pool.query(updateQuery, [
              JSON.stringify(startId),
              JSON.stringify(benchId),
              capId,
              teamName,
              userId,
              currentRoundId
          ]);
          res.json({ success: true, teamId: result.rows[0].id });
      } else {
          const insertQuery = `
              INSERT INTO user_teams (user_id, start_id, bench_id, cap_id, team_name, round_id)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id;
          `;
          const result = await pool.query(insertQuery, [
              userId,
              JSON.stringify(startId),
              JSON.stringify(benchId),
              capId,
              teamName,
              currentRoundId
          ]);
          res.json({ success: true, teamId: result.rows[0].id });
      }
  } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ success: false, error: 'Failed to save team' });
  }
});



const LocalStrategy = require('passport-local').Strategy;

// Configure Passport 
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

            return done(null, user); 
        } catch (error) {
            return done(error);
        }
    }
));

// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.user_id);
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
      client.query(`
        SELECT user_id, team_name, points
        FROM user_teams
        ORDER BY points DESC
      `, (err, result) => {
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

app.use(express.static('public'));

async function processAndUpsertData(client, filePattern, roundIdentifier) {
  try {
    const filePaths = glob.sync(filePattern);

    if (filePaths.length === 0) {
      throw new Error('No files found matching the pattern.');
    }
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

    aggregatedArray.forEach(row => {
      if ([1, 13].includes(parseInt(row['#']))) {
        row.Weighted_Score = (row.GOALS * 33) + row.SAVES;
      } else {
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

    const playerPoints = await client.query(
      'SELECT name, points, points_1, points_2, points_3, points_4, points_5, points_6, points_7, points_8, processed_rounds FROM player'
    );

    const playerMap = playerPoints.rows.reduce((acc, player) => {
      acc[player.name] = {
        points: player.points || 0,
        processed_rounds: player.processed_rounds || [],
        pointsByRound: {
          1: player.points_1 || 0,
          2: player.points_2 || 0,
          3: player.points_3 || 0,
          4: player.points_4 || 0,
          5: player.points_5 || 0,
          6: player.points_6 || 0,
          7: player.points_7 || 0,
          8: player.points_8 || 0
        }
      };
      return acc;
    }, {});

    for (const row of aggregatedArray) {
      const playerName = row.PLAYER;

      if (playerMap[playerName]) {
        const newPoints = row.Points;

        if (!playerMap[playerName].processed_rounds.includes(roundIdentifier)) {
          const totalPoints = playerMap[playerName].points + newPoints;

          await client.query(
            `UPDATE player
             SET points = $1,
                 points_${roundIdentifier} = $2,
                 processed_rounds = processed_rounds || ARRAY[$3]::integer[]
             WHERE name = $4`,
            [
              totalPoints,
              newPoints,
              roundIdentifier,
              playerName
            ]
          );
        }
      } 
    }

    return aggregatedArray;
  } catch (error) {
    console.error('Error processing data:', error);
    throw error;
  }
}



module.exports = processAndUpsertData;
app.get('/process-data', async (req, res) => {
  try {
    const client = await pool.connect();
    const currentRound = await getCurrentRound(client);

    if (!currentRound) {
      return res.status(404).json({ error: 'No current round found' });
    }

    const roundIdentifier = currentRound.round_id;
    const filePattern = '/Users/egor/Downloads/player_stats_*.csv'; 
    await processAndUpsertData(client, filePattern, roundIdentifier);

    client.release(); 
    res.status(200).json({ message: 'Data processed and upserted successfully.' });
  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).json({ error: 'Error processing data' });
  }
});

app.get('/api/current-round', async (req, res) => {
  try {
      const client = await pool.connect();
      const round = await getCurrentRound(client); 
      client.release();
      res.json(round);
  } catch (error) {
      console.error('Error fetching current round:', error);
      res.status(500).json({ error: 'Error fetching current round' });
  }
});

app.get('/api/user-team', async (req, res) => {
  const { userId, roundId } = req.query;

  try {
      const client = await pool.connect();
      const team = await getUserTeamForRound(client, userId, roundId); 
      client.release();
      if (team.length === 0) {
          res.status(404).json({ message: 'No team found' });
      } else {
          res.json({ team });
      }
  } catch (error) {
      console.error('Error fetching user team:', error);
      res.status(500).json({ error: 'Error fetching user team' });
  }
});

async function getCurrentRound(client) {
  const now = new Date();
  const query = `
      SELECT round_id, start_date, end_date, deadline
      FROM Rounds
      WHERE start_date <= $1 AND end_date >= $1
      LIMIT 1;
  `;
  const values = [now];
  const res = await client.query(query, values);
  return res.rows[0];
}

app.get('/api/team-details/:userId/:currentRound', async (req, res) => {
  const { userId } = req.params;
  const client = await pool.connect();

  try {
    const currentRound = await getCurrentRound(client);
    if (!currentRound) {
      return res.status(404).json({ success: false, error: 'No current round found.' });
    }

    const roundId = currentRound.round_id;
    const teamDetails = await getTeamDetails(userId, roundId);
    const playerIds = [...teamDetails.start_id, ...teamDetails.bench_id, teamDetails.cap_id];
    const playerPoints = await getPlayerPoints(playerIds, roundId);

    const playerMap = {};
    playerPoints.forEach(player => {
      playerMap[player.id] = {
        name: player.name,
        points: player.points
      };
    });

    const response = {
      success: true,
      team: {
        ...teamDetails,
        playerMap
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch team details.' });
  } finally {
    client.release();
  }
});

async function getTeamDetails(userId, roundId) {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT team_name AS team_name, start_id, bench_id, cap_id
      FROM user_teams
      WHERE user_id = $1 AND round_id = $2
    `, [userId, roundId]);

    if (res.rows.length === 0) {
      throw new Error('No team found for this user and round.');
    }

    const team = res.rows[0];
    return {
      teamName: team.teamname,
      start_id: team.start_id,
      bench_id: team.bench_id,
      cap_id: team.cap_id
    };
  } finally {
    client.release();
  }
}

async function getPlayerPoints(playerIds, roundId) {
  const client = await pool.connect();
  try {
    const roundColumn = `points_${roundId}`;
    const query = `
      SELECT id, name, ${roundColumn} AS points
      FROM player
      WHERE id = ANY($1::int[])
    `;
    const res = await client.query(query, [playerIds]);

    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      points: row.points
    }));
  } finally {
    client.release();
  }
}
module.exports = { getTeamDetails, getPlayerPoints };

async function getUserTeam(user_id) {
  const client = await pool.connect();
  try {
      const queryText = `
          SELECT start_id, bench_id, round_id
          FROM user_teams
          WHERE user_id = $1
          ORDER BY round_id DESC
          LIMIT 1;
      `;
      const res = await client.query(queryText, [user_id]);
      if (res.rows.length > 0) {
          const team = res.rows[0];
          const startIds = team.start_id;
          const benchIds = team.bench_id;
          
          const [startPlayers, benchPlayers] = await Promise.all([
              getPlayerNames(startIds),
              getPlayerNames(benchIds)
          ]);

          return {
              start_ids: startIds,
              bench_ids: benchIds,
              start_names: startIds.map(id => startPlayers[id] || 'Unknown'),
              bench_names: benchIds.map(id => benchPlayers[id] || 'Unknown'),
              round_id: team.round_id
          };
      } else {
          return null;
      }
  } finally {
      client.release();
  }
}

async function getPlayerNames(ids) {
  if (!ids.length) return [];

  const client = await pool.connect();
  try {
      const queryText = `SELECT id, name FROM player WHERE id = ANY($1::int[])`;
      const res = await client.query(queryText, [ids]);
      const playerNames = res.rows.reduce((acc, row) => {
          acc[row.id] = row.name;
          return acc;
      }, {});
      return playerNames;
  } finally {
      client.release();
  }
}

app.get('/api/user-team/:user_id', async (req, res) => {
  const user_id = req.params.user_id;
  try {
      const team = await getUserTeam(user_id);
      res.json(team);
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

