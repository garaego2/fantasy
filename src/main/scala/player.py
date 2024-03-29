import pandas as pd
import numpy as np
import glob
import json
import os
from datetime import datetime


def get_files_downloaded_today(directory_path):
    today = datetime.today().date()

    files_today = []
    for filename in os.listdir(directory_path):
        file_path = os.path.join(directory_path, filename)

        # Use either getctime() or getmtime() based on your requirement
        file_time = datetime.fromtimestamp(os.path.getctime(file_path)).date()

        if file_time == today:
            files_today.append(file_path)

    return files_today


directory_path = '/Users/egor/Downloads/'
file_pattern = 'player_stats_*.csv'

today_files = get_files_downloaded_today(directory_path)
combined_df = pd.DataFrame()
file_list = glob.glob(directory_path + file_pattern)

for file in file_list:
    df = pd.read_csv(file, delimiter=';')
    combined_df = pd.concat([combined_df, df], ignore_index=True)

# Player points
combined_df['Weighted_Score'] = (combined_df['GOALS'] * 6) + 2 * (combined_df['PF DRAWN'] + combined_df['SWIMOFFS'] +
                                                                  combined_df['BLOCKS'] + combined_df['ASSISTS'] +
                                                                  combined_df['STEALS']) \
                                - combined_df['PERSONAL FOULS'] - combined_df['ATTEMPTS'] \
                                - combined_df['OFFENSIVE FOULS'] - combined_df['BALLS LOST']
combined_df.loc[combined_df['#'].isin([1, 13]), 'Weighted_Score'] = (
        combined_df['GOALS'] * 33 + combined_df['SAVES'])
# print(combined_df.iloc[:, [3, -1]])


captains = {}
teams = {
    'Egor': ['Soma Vogel', 'Alvaro Granados (C)', 'Gergo Zalanki', 'Francesco di Fulvio', 'Thomas Vernoux',
             'Dusan Mandic', 'Konstantinos Kakaris'],
    'Pablo': ['Marko Bijac', 'Yusuke Inaba (C)', 'Gergo Zalanki', 'Ben Hallock', 'Szilard Jansik', 'Dusan Mandic',
              'Alvaro Granados'],
    'Grayden': ['Marko del Lungo', 'Hannes Daube (C)', 'Nickolaos Papanickola', 'Denes Varga', 'Ben Hallock',
                'Sam Slobodien', 'Jacob Mercep'],
    'Sandor': ['Soma Vogel', 'Gergo Zalanki (C)', 'Alvaro Granados', 'Francesco di Fulvio', 'Thomas Vernoux',
               'Dusan Mandic', 'Szilard Jansik'],
    'Kike': ['Marko Bijac', 'Thomas Vernoux (C)', 'Gergo Zalanki', 'Ben Hallock', 'Alvaro Granados', 'Dusan Mandic',
             'Felipe Perrone'],
    'Nemo': ['Unai Aguirre', 'Gergo Zalanki (C)', 'Alvaro Granados', 'Edoardo di Somma', 'Thomas Vernoux',
             'Nikola Jaksic', 'Krisztian Manhercz'],
    'Niklas': ['Marko del Lungo', 'Gergo Zalanki (C)', 'Alvaro Granados', 'Konstantinos Genidounias', 'Thomas Vernoux',
               'Bernat Sanahuja', 'Konstantinos Kakaris'],
    'Juho': ['Marko del Lungo', 'Gergo Zalanki (C)', 'Alvaro Granados', 'Ben Hallock', 'Thomas Vernoux', 'Dusan Mandic',
             'Konstantinos Genidounias'],
    'Nemanja': ['Petar Tesanovic', 'Alvaro Granados (C)', 'Gergo Zalanki', 'Edoardo di Somma', 'Thomas Vernoux',
                'Nikola Jaksic', 'Konstantinos Genidounias'],
    'Oskari': ['Petar Tesanovic', 'Thomas Vernoux (C)', 'Alvaro Granados', 'Ben Hallock', 'Gergo Zalanki',
               'Dusan Mandic', 'Konstantinos Kakaris'],
    'Marko': ['Soma Vogel', 'Alvaro Granados (C)', 'Gergo Zalanki', 'Francesco di Fulvio', 'Thomas Vernoux',
              'Dusan Mandic', 'Konstantinos Kakaris'],
    'Leo': ['Marko del Lungo', 'Alvaro Granados (C)', 'Gergo Zalanki', 'Felipe Perrone', 'Hannes Daube',
            'Konstantinos Genidounias', 'Konstantinos Kakaris'],
    'Alexander': ['Unai Aguirre', 'Dusan Mandic (C)', 'Rino Buric', 'Miroslav Perkovic', 'Thomas Vernoux',
                  'Nikola Jaksic', 'Konstantinos Kakaris'],

}
team_results = []

for team_name, player_list in teams.items():
    captain = [player for player in player_list if '(C)' in player]
    if captain:
        captain_name = captain[0].replace('(C)', '').strip()
        is_captain = True
    else:
        captain_name = None
        is_captain = False
    if is_captain:
        teams[team_name].append(captain_name)
    team_df = combined_df[combined_df['PLAYER'].isin(player_list)]
    points_per_player = team_df.groupby('PLAYER')['Weighted_Score'].sum()

    total_points = points_per_player.sum()
    if is_captain:
        captain_points = points_per_player.get(captain_name, 0)
        total_points += captain_points
        points_per_player[captain_name] = captain_points * 2
    team_result = {
        'Team Name': team_name,
        'Total Points': total_points,
        'Players': points_per_player.to_dict(),
        'Captain Points': captain_points * 2,
        'Captain': captain_name
    }
    team_results.append(team_result)
print(combined_df.iloc[:, [3, -1]])


# Print
def convert_to_serializable(obj):
    if pd.api.types.is_integer_dtype(obj):
        return int(obj)
    elif pd.api.types.is_float_dtype(obj):
        return float(obj)
    else:
        return obj


# Print team results
for team_result in team_results:
    print(f"\nTeam: {team_result['Team Name']}\nTotal Points: {team_result['Total Points']}")
    print("Players:")
    for player, points in team_result['Players'].items():
        print(f"{player}: {points} points")
    print(f"Captain Points: {team_result['Captain Points']} points")


# Sort team_results to create the leaderboard
def convert_to_python_int(value):
    if isinstance(value, np.int64):
        return int(value)
    return value


def generate_leaderboard(score, team_results_filename='team_results.json'):
    # Load existing leaderboard from the team_results.json file
    try:
        with open(team_results_filename, 'r') as file:
            data = json.load(file)
            team_results = data.get('leaderboard', [])
    except FileNotFoundError:
        team_results = []

    # Update the existing leaderboard with the new scores
    for new_score in score:
        team_name = new_score['Team Name']
        total_points = convert_to_python_int(new_score['Total Points'])

        # Check if the team is already in the leaderboard
        existing_team = next((team for team in team_results if team['Team Name'] == team_name), None)

        if existing_team:
            # Update the total points for the existing team
            existing_team['Total Points'] += total_points
        else:
            # Add the new team to the leaderboard
            team_results.append({'Team Name': team_name, 'Total Points': total_points})

    # Sort the updated team_results to create the cumulative leaderboard
    team_results_sorted = sorted(team_results, key=lambda x: x['Total Points'], reverse=True)

    # Output the cumulative leaderboard
    leaderboard_output = []
    for i, team_result in enumerate(team_results_sorted, start=1):
        leaderboard_output.append({'Team Name': team_result['Team Name'], 'Total Points': team_result['Total Points']})
        print(f"{i} {team_result['Team Name']}  {team_result['Total Points']}")

    # Save the updated leaderboard back to the team_results.json file
    with open(team_results_filename, 'w') as file:
        data['leaderboard'] = team_results_sorted
        json.dump(data, file, indent=2, default=str)

    return leaderboard_output


# Example usage:
leaderboard = generate_leaderboard(team_results)

# Convert int64 columns to a JSON serializable format
team_results_serializable = [{key: convert_to_serializable(value) for key, value in team.items()} for team in
                             team_results]
sorted_serializable = [{key: convert_to_serializable(value) for key, value in team.items()} for team in leaderboard]

# Save to json
output_file_path = 'team_results.json'
with open(output_file_path, 'w') as json_file:
    json.dump({'team_results': team_results_serializable, 'leaderboard': sorted_serializable}, json_file, indent=4)

print(f"\nResults saved to {output_file_path}")
