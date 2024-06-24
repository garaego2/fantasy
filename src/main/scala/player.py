import pandas as pd
import glob
import json
import os
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)


def get_files_downloaded_today(path):
    today = datetime.today().date()
    files_today = []
    for filename in os.listdir(path):
        file_path = os.path.join(path, filename)
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

combined_df['Weighted_Score'] = (combined_df['GOALS'] * 6) + 2 * (combined_df['PF DRAWN'] + combined_df['SWIMOFFS'] +
                                                                  combined_df['BLOCKS'] + combined_df['ASSISTS'] +
                                                                  combined_df['STEALS']) \
                                - combined_df['PERSONAL FOULS'] - combined_df['ATTEMPTS'] \
                                - combined_df['OFFENSIVE FOULS'] - combined_df['BALLS LOST']
combined_df.loc[combined_df['#'].isin([1, 13]), 'Weighted_Score'] = (
        combined_df['GOALS'] * 33 + combined_df['SAVES'])

teams = {}


@app.route('/save_team', methods=['POST'])
def save_team():
    data = request.get_json()
    team_name = data['teamName']
    starting_lineup = data['startingLineup']
    bench = data['bench']
    captain = data['captain']

    teams[team_name] = {
        'starting_lineup': starting_lineup,
        'bench': bench,
        'captain': captain
    }

    # Save to JSON file
    with open('teams.json', 'w') as file:
        json.dump(teams, file, indent=4)

    return jsonify({'message': 'Team saved successfully!'})


def calculate_team_points():
    team_results = []
    for team_name, details in teams.items():
        player_list = details['starting_lineup'] + details['bench']
        captain_name = details['captain']
        team_df = combined_df[combined_df['PLAYER'].isin(player_list)]
        points_per_player = team_df.groupby('PLAYER')['Weighted_Score'].sum()
        total_points = points_per_player.sum()
        if captain_name in points_per_player:
            captain_points = points_per_player[captain_name]
            total_points += captain_points
            points_per_player[captain_name] = captain_points * 2
        else:
            captain_points = 0
        team_result = {
            'Team Name': team_name,
            'Total Points': total_points,
            'Players': points_per_player.to_dict(),
            'Captain Points': captain_points * 2,
            'Captain': captain_name
        }
        team_results.append(team_result)
    return team_results


@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    team_results = calculate_team_points()
    sorted_team_results = sorted(team_results, key=lambda x: x['Total Points'], reverse=True)
    return jsonify(sorted_team_results)


def convert_to_serializable(obj):
    if pd.api.types.is_integer_dtype(obj):
        return int(obj)
    elif pd.api.types.is_float_dtype(obj):
        return float(obj)
    else:
        return obj


def generate_leaderboard(team_results):
    scores = []
    for team in team_results:
        scores.append({
            'Team Name': team['Team Name'],
            'Total Points': convert_to_serializable(team['Total Points'])
        })
    return sorted(scores, key=lambda x: x['Total Points'], reverse=True)


if __name__ == '__main__':
    app.run(debug=True)


