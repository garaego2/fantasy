// Player selection and team management
const selectedPlayers = { startingLineup: [], bench: [] };
let captainId = null;
let removedPlayers = [];
let removalCount = 0;
const MAX_REMOVALS = 2;
let selectedPlayer = null;

const transferStartDate1 = new Date('July 28, 2024 15:00:00');
const transferEndDate1 = new Date('August 1, 2024 16:00:00');
const unlimitedTransfersEnd = transferStartDate1;
const limitedTransfersStart = transferEndDate1;

function getCurrentTransferLimit() {
    const now = new Date();
    return now < unlimitedTransfersEnd ? Infinity : MAX_REMOVALS;
}

// Functions for player selection and team management
function selectPlayer(playerId, playerName) {
    const startingLineupDiv = document.getElementById('starting-lineup');
    const benchDiv = document.getElementById('bench');

    if (isPlayerSelected(playerName)) {
        alert('Player is already selected.');
        return;
    }

    let added = false;
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

function removePlayer(section, index) {
    const playerDiv = document.getElementById(`player-${section}-${index}`);
    if (!playerDiv) return;

    const playerLabel = playerDiv.querySelector('.player-label');
    if (!playerLabel) return;

    const playerId = playerLabel.dataset.playerId;
    const playerName = playerLabel.textContent;
    removedPlayers.push({ section, index, playerId, playerName });

    playerLabel.textContent = '';
    playerLabel.dataset.filled = 'false';
    playerLabel.dataset.playerId = '';

    selectedPlayers[section === 'starting-lineup' ? 'startingLineup' : 'bench'] = 
        selectedPlayers[section === 'starting-lineup' ? 'startingLineup' : 'bench'].filter(id => id !== playerId);

    removalCount++;
    updateRemovalUI();
}

function goBack() {
    if (removedPlayers.length === 0) {
        return;
    }

    const lastRemoved = removedPlayers.pop();
    const { section, index, playerId, playerName } = lastRemoved;
    const playerDiv = document.getElementById(`player-${section}-${index}`);
    if (playerDiv) {
        const playerLabel = playerDiv.querySelector('.player-label');
        if (playerLabel) {
            playerLabel.textContent = playerName;
            playerLabel.dataset.filled = 'true';
            playerLabel.dataset.playerId = playerId;

            if (section === 'starting-lineup') {
                selectedPlayers.startingLineup.push(playerId);
            } else if (section === 'bench') {
                selectedPlayers.bench.push(playerId);
            }

            removalCount--;
            updateRemovalUI();
        }
    }
}

function selectCaptain(playerDiv) {
    const section = playerDiv.parentElement.id;
    if (section !== 'starting-lineup') {
        return;
    }

    document.querySelectorAll(`#${section} .player-display .captain-button`).forEach(button => {
        button.classList.remove('captain-selected');
    });

    const captainButton = playerDiv.querySelector('.captain-button');
    captainButton.classList.add('captain-selected');

    const playerLabel = playerDiv.querySelector('.player-label');
    selectedPlayers.captainId = playerLabel.dataset.playerId;
    captainId = playerDiv.querySelector('.player-label').dataset.playerId;
}

function swapPlayers(player1, player2) {
    const [container1, container2] = [player1.parentElement, player2.parentElement];
    if (!container1 || !container2) {
        console.error('One of the containers is missing');
        return;
    }

    container1.appendChild(player2);
    container2.appendChild(player1);

    [player1.id, player2.id] = [player2.id, player1.id];

    updateCaptainButtonVisibility(player1);
    updateCaptainButtonVisibility(player2);
}

// API calls
// Fetch players from the server
function fetchPlayers(filterNationality = '', sortOrder = '', sortBy = '') {
    return fetch('fantasy-kohl.vercel.app/api/players')
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
        const response = await fetch('fantasy-kohl.vercel.app/api/current-round');
        if (!response.ok) {
            throw new Error('Failed to fetch current round');
        }
        const currentRound = await response.json();

        const saveResponse = await fetch('fantasy-kohl.vercel.app/api/save-team', {
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

// UI updates

async function updateRoundInfo() {
    try {
        const roundInfo = await findCurrentRound();
        const roundNumberElement = document.getElementById('roundNumber');
        const roundDeadlineElement = document.getElementById('roundDeadline');
        
        if (roundInfo) {
            const formattedDeadline = roundInfo.deadline ? roundInfo.deadline.toLocaleDateString() : 'No further rounds';
            roundNumberElement.textContent = `Current Round: ${roundInfo.id}`;
            roundDeadlineElement.textContent = `Deadline: ${formattedDeadline}`;
        } else {
            roundNumberElement.textContent = 'Current Round: N/A';
            roundDeadlineElement.textContent = 'Deadline: N/A';
        }
    } catch (error) {
        console.error('Error updating round information:', error);
    }
}
async function createTeamDisplays() {
    try {
        const user_id = sessionStorage.getItem('userId');
        const response = await fetch(`fantasy-kohl.vercel.app/api/user-team/${user_id}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const team = await response.json();
        const startingLineupContainer = document.getElementById('starting-lineup');
        const benchContainer = document.getElementById('bench');
        startingLineupContainer.innerHTML = '';
        benchContainer.innerHTML = '';

        const { start_names = [], bench_names = [], start_ids = [], bench_ids = [] } = team || {};
        if (!start_names.length && !bench_names.length) {
            createEmptyPlayerDisplays('starting-lineup', 7);
            createEmptyPlayerDisplays('bench', 6);
        } else {
            start_names.forEach((name, i) => name && createPlayerDisplay('starting-lineup', i, name, start_ids[i]));
            bench_names.forEach((name, i) => name && createPlayerDisplay('bench', i, name, bench_ids[i]));
        }
    } catch (error) {
        console.error('Failed to create team displays:', error);
    }
}

function displayTeamDetails(team, roundId) {
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

function updateRemovalUI() {
    const goBackButton = document.getElementById('go-back-button');
    const removalLimitMessage = document.getElementById('removal-limit-message');
    const currentLimit = getCurrentTransferLimit();
    
    goBackButton.style.display = removalCount > 0 ? 'block' : 'none';
    
    if (currentLimit !== Infinity && removalCount >= currentLimit) {
        removalLimitMessage.style.display = 'block';
    } else {
        removalLimitMessage.style.display = 'none';
    }
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
            row.dataset.playerId = player.id;

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

function updateCaptainButtonVisibility(player) {
    const section = player.parentElement.id;
    const captainButton = player.querySelector('.captain-button');

    if (section === 'starting-lineup') {
        captainButton.style.display = 'inline';
        captainButton.onclick = (event) => {
            event.stopPropagation();
            selectCaptain(player);
        };
    } else {
        captainButton.style.display = 'none';
        captainButton.onclick = null;
    }
}

function createEmptyPlayerDisplays(section, count) {
    for (let i = 0; i < count; i++) createPlayerDisplay(section, i);
}

function createPlayerDisplay(section, index, playerName = '', playerId = '') {
    const container = document.createElement('div');
    container.className = 'player-display';
    container.id = `player-${section}-${index}`;

    container.innerHTML = `
        <span class="player-label" data-filled="${playerName ? 'true' : 'false'}" data-player-id="${playerId}">${playerName}</span>
        <button type="button" class="captain-button" style="display: ${section === 'starting-lineup' ? 'inline' : 'none'}">Captain</button>
        <button type="button">Remove</button>
    `;

    container.querySelector('.captain-button').onclick = (event) => {
        event.stopPropagation();
        selectCaptain(container);
    };
    container.querySelector('button:last-child').onclick = () => removePlayer(section, index);

    document.getElementById(section).appendChild(container);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI and fetch initial data
    fetchPlayers().then(players => populateFilterOptions(players));
    createTeamDisplays();
    fetchPlayers();
    updateRoundInfo();
    setupDynamicPlayerHandling();

    // Set up event listeners
    document.getElementById('save-team-button').addEventListener('click', handleSaveTeam);
});

// Tab, login and registration

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

// Handle Registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('fantasy-kohl.vercel.app/register', {
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
        const response = await fetch('fantasy-kohl.vercel.app/login', {
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

// Rest of code

// Check if the player is already selected
function isPlayerSelected(playerName) {
    const selectedPlayers = document.querySelectorAll('#starting-lineup .player-display .player-label, #bench .player-display .player-label');
    return Array.from(selectedPlayers).some(label => label.textContent === playerName);
}

function populateFilterOptions(players) {
    const filterSelect = document.getElementById('filter-nationality');
    const predefinedNationalities = ['AUS', 'CRO', 'FRA', 'GRE', 'HUN', 'ITA', 'JPN', 'MNE', 'ROU', 'SRB', 'SPA', 'USA'];

    filterSelect.innerHTML = '<option value="">All</option>';
    predefinedNationalities.forEach(nationality => {
        const option = document.createElement('option');
        option.value = nationality;
        option.textContent = nationality;
        filterSelect.appendChild(option);
    });

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

document.querySelectorAll('#available-players tr').forEach(row => {
});

document.addEventListener('DOMContentLoaded', function() {
    window.fetchTeamDetails = function(userId) {
        getCurrentRoundId().then(currentRoundId => {
            if (currentRoundId === null) {
                alert('Could not determine the current round.');
                return;
            }

            fetch(`fantasy-kohl.vercel.app/api/team-details/${userId}/${currentRoundId}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
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
        fetch('fantasy-kohl.vercel.app/leaderboard-data')
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
                        <td><button id="viewTeamButton" onclick="fetchTeamDetails(${team.user_id})">View Team</button></td>
                    `;
                    leaderboardOutput.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error fetching leaderboard data:', error);
            });
    }

    async function getCurrentRoundId() {
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

        const now = new Date();
        for (let i = 0; i < roundStartDates.length; i++) {
            const round = roundStartDates[i];
            if (now >= round.startDate) {
                if (i === roundStartDates.length - 1 || now < roundStartDates[i + 1].startDate) {
                    return round.id;
                }
            }
        }
        return null;
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

async function findCurrentRound() {
    const roundStartDates = [
        { id: 1, startDate: new Date("2024-07-21T00:00:00+03:00"), deadline: new Date("2024-07-28T00:00:00+03:00") },
        { id: 2, startDate: new Date("2024-07-30T00:00:00+03:00"), deadline: new Date("2024-07-30T00:00:00+03:00") },
        { id: 3, startDate: new Date("2024-08-01T00:00:00+03:00"), deadline: new Date("2024-08-01T00:00:00+03:00") },
        { id: 4, startDate: new Date("2024-08-03T00:00:00+03:00"), deadline: new Date("2024-08-03T00:00:00+03:00") },
        { id: 5, startDate: new Date("2024-08-05T00:00:00+03:00"), deadline: new Date("2024-08-05T00:00:00+03:00") },
        { id: 6, startDate: new Date("2024-08-07T00:00:00+03:00"), deadline: new Date("2024-08-07T00:00:00+03:00") },
        { id: 7, startDate: new Date("2024-08-09T00:00:00+03:00"), deadline: new Date("2024-08-09T00:00:00+03:00") },
        { id: 8, startDate: new Date("2024-08-10T00:00:00+03:00"),  deadline: new Date("2024-08-10T00:00:00+03:00") }
    ];
    const now = new Date();

    for (let i = 0; i < roundStartDates.length; i++) {
        const round = roundStartDates[i];
        if (now >= round.startDate) {
            if (i === roundStartDates.length - 1 || now < roundStartDates[i + 1].startDate) {
                return {
                    id: round.id,
                    deadline: i < roundStartDates.length - 1 ? roundStartDates[i + 1].startDate : null
                };
            }
        }
    }
    return null;
}

function handlePlayerClick(player) {
    if (selectedPlayer) {
        swapPlayers(selectedPlayer, player);
        removeHighlight(selectedPlayer);
        selectedPlayer = null;
    } else {
        selectedPlayer = player;
        addHighlight(player);
    }
}

function addHighlight(player) {
    player.classList.add('player-highlighted');
}

function removeHighlight(player) {
    player.classList.remove('player-highlighted');
}

function attachPlayerClickListeners() {
    const allPlayers = document.querySelectorAll('#starting-lineup .player-display, #bench .player-display');
    allPlayers.forEach(player => {
        player.removeEventListener('click', playerClickHandler);
        player.addEventListener('click', playerClickHandler);
    });
}

function playerClickHandler(event) {
    if (event.target.classList.contains('player-label')) {
        handlePlayerClick(event.currentTarget);
    }
}

function setupDynamicPlayerHandling() {
    const observer = new MutationObserver(attachPlayerClickListeners);
    observer.observe(document.getElementById('starting-lineup'), { childList: true });
    observer.observe(document.getElementById('bench'), { childList: true });
    attachPlayerClickListeners();
}

fetch('fantasy-kohl.vercel.app/process-data')
  .then(response => {
    return response.json();
  })
  .catch(error => {
    console.error('Error:', error);
  });
