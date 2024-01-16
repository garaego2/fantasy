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
          <td>${team["Team Name"]}</td>
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
function addToOwnTeam(selectElement) {
        // Get the selected player's value
        var selectedPlayer = selectElement.value;

        // Create a new element for the selected player
        var playerElement = document.createElement("div");
        playerElement.textContent = selectedPlayer;

        // Append the player to your team container (adjust the container ID as needed)
        var ownTeamContainer = document.getElementById("ownTeamContainer");
        ownTeamContainer.appendChild(playerElement);
    }
