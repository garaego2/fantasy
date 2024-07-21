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


// Check if the player is already selected
function isPlayerSelected(playerName) {
    const selectedPlayers = document.querySelectorAll('#starting-lineup .player-display .player-label, #bench .player-display .player-label');
    return Array.from(selectedPlayers).some(label => label.textContent === playerName);
}


let removalCount = 0;
const removalLimit = 2;
const removedPlayers = [];

const transferStartDate1 = new Date('July 28, 2024 15:00:00');
const transferEndDate1 = new Date('August 1, 2024 16:00:00');
const unlimitedTransfersEnd = transferStartDate1;
const limitedTransfersStart = transferEndDate1;

function getCurrentTransferLimit() {
    const now = new Date();
    if (now < unlimitedTransfersEnd) {
        return Infinity; // Unlimited transfers
    } else if (now >= unlimitedTransfersEnd) {
        return removalLimit; // Limited transfers
    }
}

function removePlayer(section, index) {
    const currentTransferLimit = getCurrentTransferLimit();

    if (removalCount >= currentTransferLimit) {
        document.getElementById('removal-limit-message').style.display = 'block';
        return;
    }

    const playerDiv = document.getElementById(`player-${section}-${index}`);
    if (playerDiv) {
        const playerLabel = playerDiv.querySelector('.player-label');
        if (playerLabel && playerLabel.dataset.filled === 'true') {
            const playerId = playerLabel.dataset.playerId; 
            removedPlayers.push({section, index, playerId, playerName: playerLabel.textContent});

            playerLabel.textContent = ''; 
            playerLabel.dataset.filled = 'false';
            const captainButton = playerDiv.querySelector('button');
            if (captainButton) {
                captainButton.classList.remove('captain-selected'); // Clear captain class if needed
            }
            selectedPlayers.startingLineup = selectedPlayers.startingLineup.filter(id => id !== playerId);
            selectedPlayers.bench = selectedPlayers.bench.filter(id => id !== playerId);

            removalCount++;
            if (removalCount > 0) {
                document.getElementById('go-back-button').style.display = 'inline-block';
            }
            if (removalCount >= currentTransferLimit) {
                document.getElementById('removal-limit-message').style.display = 'block';
            }
        }
    }
}

function goBack() {
    if (removedPlayers.length === 0) return;

    const lastRemoved = removedPlayers.pop();
    const { section, index, playerId, playerName } = lastRemoved;
    const playerDiv = document.getElementById(`player-${section}-${index}`);
    if (playerDiv) {
        const playerLabel = playerDiv.querySelector('.player-label');
        if (playerLabel) {
            playerLabel.textContent = playerName; 
            playerLabel.dataset.filled = 'true'; 

            // Add player back to selected lists
            if (section === 'startingLineup') {
                selectedPlayers.startingLineup.push(playerId);
            } else if (section === 'bench') {
                selectedPlayers.bench.push(playerId);
            }

            removalCount--;
            if (removalCount < getCurrentTransferLimit()) {
                document.getElementById('removal-limit-message').style.display = 'none';
            }
            if (removalCount === 0) {
                document.getElementById('go-back-button').style.display = 'none';
            }
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
            captainButton.classList.add('captain-selected'); 
            selectedPlayers.captainId = playerDiv.querySelector('.player-label').dataset.playerId; 
            captainId = playerDiv.querySelector('.player-label').dataset.playerId;
        }
    }
}

// Create starting lineup and bench display divs
function createTeamDisplays() {
    const startingLineupCount = 7;
    const benchCount = 6;

    for (let i = 0; i < startingLineupCount; i++) {
        createPlayerDisplay('starting-lineup', i);
    }

    for (let i = 0; i < benchCount; i++) {
        createPlayerDisplay('bench', i);
    }
}

// Fetch players from the server
function fetchPlayers(filterNationality = '', sortOrder = '', sortBy = '') {
    return fetch('http://localhost:3000/api/players')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (filterNationality) {
                data = data.filter(player => player.nationality === filterNationality);
            }

            if (sortBy) {
                const validSortFields = ['points', 'p_points'];
                if (!validSortFields.includes(sortBy)) {
                    throw new Error(`Invalid sort field: ${sortBy}`);
                }

                if (data.length > 0 && !data[0].hasOwnProperty(sortBy)) {
                    throw new Error(`Sort field '${sortBy}' is missing from player data`);
                }

                if (sortOrder === 'asc') {
                    data.sort((a, b) => a[sortBy] - b[sortBy]);
                } else {
                    data.sort((a, b) => b[sortBy] - a[sortBy]);
                }
            }

            displayPlayers(data); 
            return data; 
        })
        .catch(error => {
            console.error('Error fetching players:', error);
            return [];
        });
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

            const p_pointsCell = document.createElement('td');
            p_pointsCell.textContent = player.p_points;

            row.appendChild(nameCell);
            row.appendChild(nationalityCell);
            row.appendChild(pointsCell);
            row.appendChild(p_pointsCell);

            row.addEventListener('click', () => {
                selectPlayer(player.id, player.name); 
            });

            availablePlayersTBody.appendChild(row);
        } else {
            console.warn('Player object missing name, points, nationality, or id:', player);
        }
    });
}


function populateFilterOptions(players) {
    const filterSelect = document.getElementById('filter-nationality');
    const predefinedNationalities = ['AUS', 'CRO', 'FRA', 'GRE', 'HUN', 'ITA', 'JPN', 'MNE', 'ROU', 'SRB', 'SPA', 'USA'];

    // Add predefined options
    filterSelect.innerHTML = '<option value="">All</option>';
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
        const section = button.closest('.player-display').parentElement.id; 
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
let selectedPlayers = {};

document.querySelectorAll('#available-players tr').forEach(row => {
});

async function handleSaveTeam() {
    const userId = sessionStorage.getItem('userId');
    const username = sessionStorage.getItem('username'); 
    if (!userId) {
        alert('User not logged in.');
        return;
    }

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

    try {
        const response = await fetch('http://localhost:3000/api/current-round');
        if (!response.ok) {
            throw new Error('Failed to fetch current round');
        }
        const currentRound = await response.json();
        console.log(currentRound)

        const saveResponse = await fetch('http://localhost:3000/api/save-team', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                teamName: username,
                startId: startingLineup.length ? startingLineup : previousTeam.startId,
                benchId: bench.length ? bench : previousTeam.benchId,
                capId: captainId
            })
        });

        if (!saveResponse.ok) {
            throw new Error('Failed to save team');
        }
        
        alert('Team saved successfully!');
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save team: ' + error.message);
    }
}

// Handle player selection and placement
function selectPlayer(playerId, playerName) {
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
                playerLabel.dataset.filled = 'true'; 
                playerLabel.dataset.playerId = playerId;
                selectedPlayers.startingLineup.push(playerId); 
                added = true;
                return true; 
            }
        }
        return false; 
    });

    // If not added to starting lineup, try to add player to the bench
    if (!added) {
        Array.from(benchDiv.children).some((div) => {
            if (div instanceof HTMLElement) {
                const playerLabel = div.querySelector('.player-label');
                if (playerLabel && playerLabel.dataset.filled === 'false') {
                    playerLabel.textContent = playerName;
                    playerLabel.dataset.filled = 'true';
                    playerLabel.dataset.playerId = playerId; 
                    selectedPlayers.bench.push(playerId); 
                    added = true;
                    return true; 
                }
            }
            return false; 
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

        const result = await response.text(); 
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
        sessionStorage.setItem('userId', result.userId); 
        sessionStorage.setItem('username', result.username)
        document.getElementById('loginMessage').textContent = 'Login successful!';

    } catch (error) {
        document.getElementById('loginMessage').textContent = error.message;
    }
});

function createPlayerDisplay(section, index) {
    const container = document.createElement('div');
    container.className = 'player-display';
    container.id = `player-${section}-${index}`;

    const playerLabel = document.createElement('span');
    playerLabel.className = 'player-label';
    playerLabel.dataset.filled = 'false'; 

    const captainButton = document.createElement('button');
    captainButton.type = 'button';
    captainButton.textContent = 'Captain';
    captainButton.className = 'captain-button'; 
    captainButton.onclick = () => selectCaptain(section, index);
    captainButton.style.display = section === 'starting-lineup' ? 'inline' : 'none'; 

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.onclick = () => removePlayer(section, index);

    container.appendChild(playerLabel);
    container.appendChild(captainButton);
    container.appendChild(removeButton);

    document.getElementById(section).appendChild(container);
}

document.addEventListener('DOMContentLoaded', function() {
    // Define global functions to ensure they are accessible from HTML
    window.fetchTeamDetails = function(userId) {
        // Get the current round ID asynchronously
        getCurrentRoundId().then(currentRoundId => {
            if (currentRoundId === null) {
                alert('Could not determine the current round.');
                return;
            }

            fetch(`http://localhost:3000/api/team-details/${userId}/${currentRoundId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Received data:', data); // Log the data for debugging
                    if (data.success) {
                        displayTeamDetails(data.team, currentRoundId);
                    } else {
                        alert(data.error);
                    }
                })
                .catch(error => {
                    console.error('Error fetching team details:', error);
                    alert('Failed to fetch team details.');
                });
        }).catch(error => {
            console.error('Error determining current round:', error);
        });
    };

    function fetchLeaderboardData() {
        fetch('http://localhost:3000/leaderboard-data')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                const leaderboardOutput = document.getElementById('leaderboard-output');
                leaderboardOutput.innerHTML = '';

                data.leaderboardData.forEach(team => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${team.team_name}</td>
                        <td>${team.points}</td>
                        <td><button onclick="fetchTeamDetails(${team.user_id})">View Team</button></td>
                    `;
                    leaderboardOutput.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error fetching leaderboard data:', error);
            });
    }

    async function getCurrentRoundId() {
        // Define the start dates for each round
        const roundStartDates = [
            { id: 1, startDate: new Date("2024-07-21T00:00:00+03:00") },
            { id: 2, startDate: new Date("2024-07-30T00:00:00+03:00") },
            { id: 3, startDate: new Date("2024-08-01T00:00:00+03:00") },
            { id: 4, startDate: new Date("2024-08-03T00:00:00+03:00") },
            { id: 5, startDate: new Date("2024-08-05T00:00:00+03:00") },
            { id: 6, startDate: new Date("2024-08-07T00:00:00+03:00") },
            { id: 7, startDate: new Date("2024-08-09T00:00:00+03:00") },
            { id: 8, startDate: new Date("2024-08-10T00:00:00+03:00") }
        ];

        // Get the current date and time
        const now = new Date();

        // Determine the current round ID based on the start dates
        for (let i = 0; i < roundStartDates.length; i++) {
            const round = roundStartDates[i];
            if (now >= round.startDate) {
                // Return the ID of the round that has started but not yet finished
                if (i === roundStartDates.length - 1 || now < roundStartDates[i + 1].startDate) {
                    return round.id;
                }
            }
        }

        // If no rounds match, return null or an appropriate default value
        return null;
    }

    function displayTeamDetails(team, roundId) {
        console.log('Displaying team details for team:', team); // Log the team details for debugging
        const teamContainer = document.getElementById('team-details');
        teamContainer.innerHTML = `
            <h2>${team.teamName}</h2>
            <h3>Starting Lineup</h3>
            <ul>
                ${team.start_id.map(player_id => {
                    const player = team.playerMap[player_id] || { name: 'Unknown Player', points: 0 };
                    return `<li>${player.name}: ${player.points}</li>`;
                }).join('')}
            </ul>
            <h3>Bench</h3>
            <ul>
                ${team.bench_id.map(player_id => {
                    const player = team.playerMap[player_id] || { name: 'Unknown Player', points: 0 };
                    return `<li>${player.name}: ${player.points}</li>`;
                }).join('')}
            </ul>
            <h3>Captain</h3>
            <p>${team.playerMap[team.cap_id]?.name || 'Unknown Player'}: ${team.playerMap[team.cap_id]?.points || 0}</p>
        `;
    }

    fetchLeaderboardData();
});




  
document.addEventListener('DOMContentLoaded', () => {
    const filterNationality = document.getElementById('filter-nationality');
    const sortMethod = document.getElementById('sort-method');

    function updatePlayers() {
        const selectedNationality = filterNationality.value;
        const selectedSortMethod = sortMethod.value;

        let sortOrder = '';
        let sortBy = ''; 

        if (selectedSortMethod === 'points-asc' || selectedSortMethod === 'points-desc') {
            sortBy = 'points';
            sortOrder = selectedSortMethod.split('-')[1];
        } else if (selectedSortMethod === 'p_points-asc' || selectedSortMethod === 'p_points-desc') {
            sortBy = 'p_points';
            sortOrder = selectedSortMethod.split('-')[1];
        }
        fetchPlayers(selectedNationality, sortOrder, sortBy)
    }

    filterNationality.addEventListener('change', updatePlayers);
    sortMethod.addEventListener('change', updatePlayers);

    updatePlayers();
});

fetch('http://localhost:3000/process-data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
