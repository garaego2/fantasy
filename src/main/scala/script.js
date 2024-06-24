fetch("team_results.json")
  .then(function(response) {
    return response.json();
  })
  .then(function(results) {
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
    `;
      teamDetailsOut += `
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
  });

function addToOwnTeam(playerDropdownId, positionDropdownId) {
    var selectedPlayer = document.getElementById(playerDropdownId).value;
    var selectedPosition = document.getElementById(positionDropdownId).value;

    if (selectedPlayer && selectedPosition) {
        var playerContainer = document.createElement("div");
        var playerElement = document.createElement("span");
        playerElement.textContent = selectedPlayer;

        // Create a radio button for the player
        var radioBtn = document.createElement("input");
        radioBtn.type = "radio";
        radioBtn.name = "captain";

        // Append the player, radio button, and position to the container
        playerContainer.appendChild(playerElement);
        playerContainer.appendChild(radioBtn);
        playerContainer.appendChild(document.createTextNode(" (" + selectedPosition + ")"));

        var ownTeamContainer = document.getElementById("ownTeamContainer");
        ownTeamContainer.appendChild(playerContainer);
    }
}

function restartTeam() {
    // Remove all player containers
    var containers = document.querySelectorAll("#ownTeamContainer");
    containers.forEach(function (container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    });
}


function saveTeam() {
  teamName = prompt("Enter a name for your team:");
    var teamData = {
        userName: teamName,
        goalkeepers: [],
        fieldPlayers: [],
        benchPlayers: [],
        captain: null,
    };

    if (teamName !== null && teamName.trim() !== "") {
        // Iterate through all player containers in ownTeamContainer
        var ownTeamContainer = document.getElementById("ownTeamContainer");
        var playerContainers = ownTeamContainer.querySelectorAll("div");

        playerContainers.forEach(function (container) {
            var playerName = container.textContent.trim();

            // Check the parent container to determine the player's position
            if (container.parentElement.id === "goalkeeperContainer") {
                teamData.goalkeepers.push(playerName);
            } else if (container.parentElement.id === "outfieldPlayersContainer") {
                teamData.fieldPlayers.push(playerName);
            } else if (container.parentElement.id === "benchPlayersContainer") {
                teamData.benchPlayers.push(playerName);
            }

            // Check for the selected captain
            var radioBtn = container.querySelector("input[name='captain']");
            if (radioBtn && radioBtn.checked) {
                teamData.captain = playerName;
            }
        });

        // Convert teamData to JSON
        var jsonString = JSON.stringify(teamData);
        console.log(jsonString);
    }
}

function openTab(evt, tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}


/* scripts.js */

// Function to dynamically create player input fields
function createPlayerInput(section, index) {
    const container = document.createElement('div');
    container.className = 'player-input';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-name';
    input.placeholder = `Player ${index + 1}`;
    input.setAttribute('list', 'players');
    input.required = true;

    const captainButton = document.createElement('button');
    captainButton.type = 'button';
    captainButton.textContent = 'Captain';
    captainButton.onclick = () => selectCaptain(section, index);

    container.appendChild(input);
    container.appendChild(captainButton);

    document.getElementById(section).appendChild(container);
}

// Function to create starting lineup and bench inputs
function createTeamInputs() {
    const startingLineupCount = 7;
    const benchCount = 6;

    for (let i = 0; i < startingLineupCount; i++) {
        createPlayerInput('starting-lineup', i);
    }

    for (let i = 0; i < benchCount; i++) {
        createPlayerInput('bench', i);
    }
}

// Function to handle captain selection
function selectCaptain(section, index) {
    // Deselect all captain buttons
    const captainButtons = document.querySelectorAll(`#${section} .player-input button`);
    captainButtons.forEach(button => button.classList.remove('captain-selected'));

    // Select the clicked captain button
    captainButtons[index].classList.add('captain-selected');
}

// Function to save team data
function saveTeam() {
    const teamName = document.getElementById('team-name').value;
    const startingLineup = [];
    const bench = [];
    let captain = '';

    document.querySelectorAll('#starting-lineup .player-name').forEach((input, index) => {
        startingLineup.push(input.value);
        if (input.nextSibling.classList.contains('captain-selected')) {
            captain = input.value;
        }
    });

    document.querySelectorAll('#bench .player-name').forEach((input, index) => {
        bench.push(input.value);
        if (input.nextSibling.classList.contains('captain-selected')) {
            captain = input.value;
        }
    });

    const teamData = {
        teamName,
        startingLineup,
        bench,
        captain
    };

    // Call Python function to save data
    fetch('/save_team', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        alert('Team saved successfully!');
    })
    .catch((error) => {
        console.error('Error:', error);
        alert('An error occurred while saving the team.');
    });
}

// Initialize team inputs on page load
document.addEventListener('DOMContentLoaded', createTeamInputs);
