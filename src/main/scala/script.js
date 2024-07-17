// Fetch and display leaderboard and team results
fetch("team_results.json")
  .then(response => response.json())
  .then(results => {
    let leaderboardPlaceholder = document.querySelector("#leaderboard-output");
    let teamDetailsPlaceholder = document.querySelector("#team-details-output");
    let leaderboardOut = "";
    let teamDetailsOut = "";

    // Display leaderboard
    for (let team of results.leaderboard) {
      leaderboardOut += `
        <tr>
          <td>${team["Team Name"]}</td>
          <td>${team["Total Points"]}</td>
        </tr>
      `;
    }
    leaderboardPlaceholder.innerHTML = leaderboardOut;

    // Display team details
    for (let team of results.team_results) {
      teamDetailsOut += `
        <tr>
            <td colspan="14"></td>
        </tr>
        <tr>
            <td class="bold">${team["Team Name"]}</td>
            <td>${team["Total Points"]}</td>
        </tr>
        <tr>
            <td colspan="2">Players:</td>
        </tr>
      `;

      // Loop through the Players object
      for (let player in team.Players) {
        let captainMark = (team["Captain"] === player) ? " (C)" : ""; // Add (C) next to the captain's name
        teamDetailsOut += `
            <tr>
                <td>${player}${captainMark}</td>
                <td>${team.Players[player]}</td>
            </tr>
        `;
      }
    }
    teamDetailsPlaceholder.innerHTML = teamDetailsOut;
  })
  .catch(error => console.error('Error loading team results:', error));

// Function to handle tab switching
function openTab(evt, tabName) {
    let i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}


//////////

const selectedPlayers = {
    startingLineup: [],
    bench: [],
    captainId: null
};

// Check if the player is already selected
function isPlayerSelected(playerName) {
    const selectedPlayers = document.querySelectorAll('#starting-lineup .player-display .player-label, #bench .player-display .player-label');
    return Array.from(selectedPlayers).some(label => label.textContent === playerName);
}

// Create player display divs instead of input fields
function createPlayerDisplay(section, index) {
    const container = document.createElement('div');
    container.className = 'player-display';
    container.id = `player-${section}-${index}`;

    const playerLabel = document.createElement('span');
    playerLabel.className = 'player-label';
    playerLabel.dataset.filled = 'false'; // Initialize as not filled

    const captainButton = document.createElement('button');
    captainButton.type = 'button';
    captainButton.textContent = 'Captain';
    captainButton.className = 'captain-button'; // Add class for styling
    captainButton.onclick = () => selectCaptain(section, index);
    captainButton.style.display = section === 'starting-lineup' ? 'inline' : 'none'; // Show only for starting lineup

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.onclick = () => removePlayer(section, index);

    container.appendChild(playerLabel);
    container.appendChild(captainButton);
    container.appendChild(removeButton);

    document.getElementById(section).appendChild(container);
}

// Remove player from the lineup or bench
function removePlayer(section, index) {
    const playerDiv = document.getElementById(`player-${section}-${index}`);
    if (playerDiv) {
        const playerLabel = playerDiv.querySelector('.player-label');
        if (playerLabel && playerLabel.dataset.filled === 'true') {
            const playerId = playerLabel.dataset.playerId; // Store player ID before clearing
            playerLabel.textContent = ''; // Clear player name
            playerLabel.dataset.filled = 'false'; // Mark slot as empty
            // Optionally, reset captain status if needed
            const captainButton = playerDiv.querySelector('button');
            if (captainButton) {
                captainButton.classList.remove('captain-selected'); // Clear captain class if needed
            }
            // Remove player from selected lists
            selectedPlayers.startingLineup = selectedPlayers.startingLineup.filter(id => id !== playerId);
            selectedPlayers.bench = selectedPlayers.bench.filter(id => id !== playerId);
            console.log(`Removed player from ${section}: ${playerLabel.textContent}`); // Debug log
        }
    }
}

// Select captain for a slot
function selectCaptain(section, index) {
    const playerDivs = document.querySelectorAll(`#${section} .player-display`);
    playerDivs.forEach(div => {
        const captainButton = div.querySelector('button.captain-button');
        if (captainButton) {
            captainButton.classList.remove('captain-selected');
        }
    });

    const playerDiv = document.getElementById(`player-${section}-${index}`);
    if (playerDiv) {
        const captainButton = playerDiv.querySelector('button.captain-button');
        if (captainButton) {
            captainButton.classList.add('captain-selected'); // Highlight the captain button
            selectedPlayers.captainId = playerDiv.querySelector('.player-label').dataset.playerId; // Update the selected captain ID
            captainId = playerDiv.querySelector('.player-label').dataset.playerId;
        }
    }
    console.log(`Captain selected: ${selectedPlayers.captainId}`);
}

// Create starting lineup and bench display divs
function createTeamDisplays() {
    const startingLineupCount = 7;
    const benchCount = 6;

    // Create starting lineup slots
    for (let i = 0; i < startingLineupCount; i++) {
        createPlayerDisplay('starting-lineup', i);
    }

    // Create bench slots
    for (let i = 0; i < benchCount; i++) {
        createPlayerDisplay('bench', i);
    }
}

// Fetch players from the server
function fetchPlayers(filterNationality = '', sortOrder = 'desc') {
    return fetch('http://localhost:3000/api/players')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json(); // Parse as JSON directly
        })
        .then(data => {
            console.log('Fetched players:', data); // Debug log

            // Apply filter if specified
            if (filterNationality) {
                data = data.filter(player => player.nationality === filterNationality);
            }

            // Sort players based on the selected sort method
            if (sortOrder === 'asc') {
                data.sort((a, b) => a.points - b.points);
            } else {
                data.sort((a, b) => b.points - a.points);
            }

            displayPlayers(data); // Display the filtered and sorted data
            return data; // Return the filtered and sorted data
        })
        .catch(error => console.error('Error fetching players:', error));
}


// Populate the player list on the right side
function displayPlayers(players) {
    const availablePlayersTBody = document.getElementById('available-players');
    availablePlayersTBody.innerHTML = '';

    if (!Array.isArray(players)) {
        console.error('Expected an array of players but got:', players);
        return;
    }

    players.forEach(player => {
        if (player.name && player.points != null && player.nationality && player.id) {
            const row = document.createElement('tr');
            row.dataset.playerId = player.id; // Store player ID in a data attribute

            const nameCell = document.createElement('td');
            nameCell.textContent = player.name;

            const pointsCell = document.createElement('td');
            pointsCell.textContent = player.points;

            const nationalityCell = document.createElement('td');
            nationalityCell.textContent = player.nationality;

            row.appendChild(nameCell);
            row.appendChild(pointsCell);
            row.appendChild(nationalityCell);

            row.addEventListener('click', () => {
                selectPlayer(player.id, player.name); // Ensure playerId is passed here
            });

            availablePlayersTBody.appendChild(row);
        } else {
            console.warn('Player object missing name, points, nationality, or id:', player);
        }
    });
}


function populateFilterOptions(players) {
    const filterSelect = document.getElementById('filter-nationality');
    const predefinedNationalities = ['AUS', 'CRO', 'USA', 'ITA', 'JPN'];

    // Add predefined options
    filterSelect.innerHTML = '<option value="">All</option>'; // Reset filter options
    predefinedNationalities.forEach(nationality => {
        const option = document.createElement('option');
        option.value = nationality;
        option.textContent = nationality;
        filterSelect.appendChild(option);
    });

    // Add dynamically fetched options
    const nationalities = new Set(players.map(player => player.nationality));
    nationalities.forEach(nationality => {
        if (!predefinedNationalities.includes(nationality)) {
            const option = document.createElement('option');
            option.value = nationality;
            option.textContent = nationality;
            filterSelect.appendChild(option);
        }
    });
}

// Initialize team displays and fetch player data on page load
document.addEventListener('DOMContentLoaded', () => {
    createTeamDisplays();
    fetchPlayers();
});
document.getElementById('filter-nationality').addEventListener('change', (event) => {
    const filterNationality = event.target.value;
    const sortOrder = document.getElementById('sort-method').value;
    fetchPlayers(filterNationality, sortOrder);
});

document.getElementById('sort-method').addEventListener('change', (event) => {
    const sortOrder = event.target.value;
    const filterNationality = document.getElementById('filter-nationality').value;
    fetchPlayers(filterNationality, sortOrder);
});
document.querySelector('.container').addEventListener('click', function(event) {
    if (event.target.classList.contains('captain-button')) {
        const button = event.target;
        const section = button.closest('.player-display').parentElement.id; // Assuming section is parent element id
        const index = Array.from(button.closest('.player-display').parentElement.children).indexOf(button.closest('.player-display'));
        selectCaptain(section, index);
    }
});
// Initialize and fetch player data on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchPlayers().then(players => populateFilterOptions(players));
});

// Add event listener to the Save Team button
document.getElementById('save-team-button').addEventListener('click', handleSaveTeam);

//////////
let captainId = null;

document.querySelectorAll('#available-players tr').forEach(row => {
    console.log(row.dataset.playerId); // Should log the correct playerId
});

function handleSaveTeam() {

    const startingLineup = Array.from(document.querySelectorAll('#starting-lineup .player-label'))
        .map(label => label.dataset.playerId)
        .filter(id => id);

    const bench = Array.from(document.querySelectorAll('#bench .player-label'))
        .map(label => label.dataset.playerId)
        .filter(id => id);

    if (!captainId) {
        alert('Please select a captain.');
        return;
    }

    console.log('Sending data:', {
        userId: "1",
        teamName: "teamName",
        startId: startingLineup,
        benchId: bench,
        capId: captainId
    });

    fetch('http://localhost:3000/api/save-team', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userId: "1",
            teamName: "teamName",
            startId: startingLineup,
            benchId: bench,
            capId: captainId
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text) });
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        alert('Team saved successfully!');
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to save team: ' + error.message);
    });
}


// Handle player selection and placement
function selectPlayer(playerId, playerName) {
    console.log('Selecting player:', playerName); // Debug log

    const startingLineupDiv = document.getElementById('starting-lineup');
    const benchDiv = document.getElementById('bench');

    if (isPlayerSelected(playerName)) {
        alert('Player is already selected.');
        return;
    }

    let added = false;

    // Try to add player to the starting lineup
    Array.from(startingLineupDiv.children).some((div) => {
        if (div instanceof HTMLElement) {
            const playerLabel = div.querySelector('.player-label');
            if (playerLabel && playerLabel.dataset.filled === 'false') {
                playerLabel.textContent = playerName;
                playerLabel.dataset.filled = 'true'; // Mark this slot as filled
                playerLabel.dataset.playerId = playerId; // Set player ID
                selectedPlayers.startingLineup.push(playerId); // Save player ID
                added = true;
                console.log(`Added player to starting lineup: ${playerName}`); // Debug log
                return true; // Stop the loop
            }
        }
        return false; // Continue the loop
    });

    // If not added to starting lineup, try to add player to the bench
    if (!added) {
        Array.from(benchDiv.children).some((div) => {
            if (div instanceof HTMLElement) {
                const playerLabel = div.querySelector('.player-label');
                if (playerLabel && playerLabel.dataset.filled === 'false') {
                    playerLabel.textContent = playerName;
                    playerLabel.dataset.filled = 'true'; // Mark this slot as filled
                    playerLabel.dataset.playerId = playerId; // Set player ID
                    selectedPlayers.bench.push(playerId); // Save player ID
                    added = true;
                    console.log(`Added player to bench: ${playerName}`); // Debug log
                    return true; // Stop the loop
                }
            }
            return false; // Continue the loop
        });
    }

    if (!added) {
        alert('No available slot for the player.');
    }
}

// Handle Registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error('Registration failed');
        }

        const result = await response.text(); // Assuming the server sends a text response
        document.getElementById('registerMessage').textContent = 'Registration successful: ' + result;
    } catch (error) {
        document.getElementById('registerMessage').textContent = error.message;
    }
});


// Handle Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const result = await response.json();
        document.getElementById('loginMessage').textContent = 'Login successful.'
    } catch (error) {
        document.getElementById('loginMessage').textContent = error.message;
    }
});


// Fetch the user's team from the server
async function fetchUserTeam() {
    const token = localStorage.getItem('authToken'); // Assuming you're storing the auth token in local storage

    try {
        const response = await fetch('http://localhost:3000/api/user-team', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user team');
        }

        const teamData = await response.json();
        populateTeamData(teamData);
    } catch (error) {
        console.error('Error fetching user team:', error);
        document.getElementById('teamMessage').textContent = 'Error fetching team data';
    }
}

// Populate the team display with fetched data
function populateTeamData(teamData) {
    const { startingLineup, bench, captainId } = teamData;

    // Clear existing team displays
    document.querySelectorAll('#starting-lineup .player-display, #bench .player-display').forEach(div => {
        const playerLabel = div.querySelector('.player-label');
        if (playerLabel) {
            playerLabel.textContent = '';
            playerLabel.dataset.filled = 'false';
            playerLabel.dataset.playerId = '';
        }
    });

    // Populate starting lineup
    startingLineup.forEach((playerId, index) => {
        const playerDiv = document.getElementById(`player-starting-lineup-${index}`);
        if (playerDiv) {
            const playerLabel = playerDiv.querySelector('.player-label');
            if (playerLabel) {
                playerLabel.textContent = playerId; // Assuming you have a way to get player name from ID
                playerLabel.dataset.filled = 'true';
                playerLabel.dataset.playerId = playerId;
            }
        }
    });

    // Populate bench
    bench.forEach((playerId, index) => {
        const playerDiv = document.getElementById(`player-bench-${index}`);
        if (playerDiv) {
            const playerLabel = playerDiv.querySelector('.player-label');
            if (playerLabel) {
                playerLabel.textContent = playerId; // Assuming you have a way to get player name from ID
                playerLabel.dataset.filled = 'true';
                playerLabel.dataset.playerId = playerId;
            }
        }
    });

    // Set captain
    const captainDiv = document.querySelector(`#starting-lineup .player-display .player-label[data-player-id="${captainId}"]`);
    if (captainDiv) {
        const captainButton = captainDiv.closest('.player-display').querySelector('button.captain-button');
        if (captainButton) {
            captainButton.classList.add('captain-selected');
            selectedPlayers.captainId = captainId;
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    createTeamDisplays();
    fetchPlayers().then(players => populateFilterOptions(players));
    fetchUserTeam(); // Fetch user's team data on page load
});