# Step 5: Web Scraping
# Install the necessary libraries using: pip install requests beautifulsoup4
import requests
from bs4 import BeautifulSoup

# Function to scrape water polo game results from total-waterpolo
def scrape_water_polo_results():
    url = "https://www.total-waterpolo.com/results"
    response = requests.get(url)

    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        # Extract relevant information from the website
        # Modify this part based on the structure of the total-waterpolo website
        # For example, find the elements containing team names, scores, etc.
        results = soup.find_all('div', class_='result')
        game_results = []
        for result in results:
            team1 = result.find('span', class_='team1').text
            team2 = result.find('span', class_='team2').text
            score_team1 = result.find('span', class_='score1').text
            score_team2 = result.find('span', class_='score2').text
            game_results.append({
                'team1': team1,
                'team2': team2,
                'score_team1': score_team1,
                'score_team2': score_team2
            })
        return game_results
    else:
        print("Error fetching data from total-waterpolo")
        return []

# Step 6: Database Setup
# Install the necessary library using: pip install sqlite3
import sqlite3

# Function to create a SQLite database and a table for game results
def setup_database():
    conn = sqlite3.connect('water_polo_fantasy.db')
    cursor = conn.cursor()

    # Create a table for game results
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS game_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team1 TEXT,
            team2 TEXT,
            score_team1 INTEGER,
            score_team2 INTEGER
        )
    ''')

    conn.commit()
    conn.close()

# Main function to scrape data, store it in the database, and fetch it
def main():
    # Step 5: Web Scraping
    game_results = scrape_water_polo_results()

    # Step 6: Database Setup
    setup_database()

    # Insert scraped game results into the database
    conn = sqlite3.connect('water_polo_fantasy.db')
    cursor = conn.cursor()

    for result in game_results:
        cursor.execute('''
            INSERT INTO game_results (team1, team2, score_team1, score_team2)
            VALUES (?, ?, ?, ?)
        ''', (result['team1'], result['team2'], result['score_team1'], result['score_team2']))

    conn.commit()

    # Fetch game results from the database
    cursor.execute('SELECT * FROM game_results')
    fetched_results = cursor.fetchall()

    print("Scraped Results:")
    for row in fetched_results:
        print(row)

    conn.close()

if __name__ == "__main__":
    main()
