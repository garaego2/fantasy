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
          <td class="bold">${team["Team Name"]}</td>
          <td>${team["Total Points"]}</td>
          <td>${team["Captain"]}</td>
          <td>${team["Captain Points"]}</td>
        </tr>
        <tr>
          <td colspan="4">Players:</td>
        </tr>
      `;

      // Loop through the Players object
      for (let player in team.Players) {
        teamDetailsOut += `
          <tr>
            <td colspan="2">${player}</td>
            <td colspan="2">${team.Players[player]}</td>
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
