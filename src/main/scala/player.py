import pandas as pd
import os
import glob
from flask import Flask, jsonify
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)

def process_and_upsert_data(engine, file_pattern):
    try:
        # Use glob to find all files matching the pattern
        file_paths = glob.glob(file_pattern)
        
        if not file_paths:
            raise FileNotFoundError("No files found matching the pattern.")

        # Read and concatenate all CSV files into a single DataFrame
        combined_df = pd.concat((pd.read_csv(file_path, delimiter=';') for file_path in file_paths), ignore_index=True)

        # Print the combined DataFrame for debugging
        print("Combined DataFrame:")
        print(combined_df.head())

        # Aggregate data by player
        aggregated_df = combined_df.groupby('PLAYER').agg({
            'GOALS': 'sum',
            'PF DRAWN': 'sum',
            'SWIMOFFS': 'sum',
            'BLOCKS': 'sum',
            'ASSISTS': 'sum',
            'STEALS': 'sum',
            'PERSONAL FOULS': 'sum',
            'ATTEMPTS': 'sum',
            'OFFENSIVE FOULS': 'sum',
            'BALLS LOST': 'sum',
            'SAVES': 'sum'
        }).reset_index()

        # Print the aggregated DataFrame for debugging
        print("Aggregated DataFrame:")
        print(aggregated_df.head())

        # Calculate 'Weighted_Score' and 'Points'
        aggregated_df['Weighted_Score'] = (
            (aggregated_df['GOALS'] * 6) + 
            2 * (aggregated_df['PF DRAWN'] + aggregated_df['SWIMOFFS'] +
                 aggregated_df['BLOCKS'] + aggregated_df['ASSISTS'] +
                 aggregated_df['STEALS']) - 
            aggregated_df['PERSONAL FOULS'] - 
            aggregated_df['ATTEMPTS'] - 
            aggregated_df['OFFENSIVE FOULS'] - 
            aggregated_df['BALLS LOST']
        )
        aggregated_df.loc[aggregated_df['PLAYER'].isin([1, 13]), 'Weighted_Score'] = (
            aggregated_df['GOALS'] * 33 + aggregated_df['SAVES']
        )
        aggregated_df['Points'] = aggregated_df['Weighted_Score']

        # Print final DataFrame before database update
        print("Final DataFrame with Points:")
        print(aggregated_df.head())

        # Create a session to interact with the database
        Session = sessionmaker(bind=engine)
        session = Session()

        # Iterate through the aggregated DataFrame rows
        for _, row in aggregated_df.iterrows():
            player_name = row['PLAYER']
            points = row['Points']
            
            # Update the player's points in the database
            session.execute(
                text(
                    "UPDATE player SET p_points = :points WHERE name = :name"
                ),
                {"points": points, "name": player_name}
            )
        
        # Commit the transaction
        session.commit()

        # Close the session
        session.close()

        return aggregated_df
    except Exception as e:
        print(f"Error processing data: {e}")
        raise


@app.route('/process-data', methods=['POST'])
def process_data():
    
    try:
        file_pattern = "/Users/egor/Downloads/player_stats_*.csv"  # Pattern to match all CSV files

        # Database credentials from environment variables
        db_username = os.getenv('DB_USER', 'postgres')
        db_password = os.getenv('DB_PASSWORD', 'Sinitiaisenpolku1')
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = int(os.getenv('DB_PORT', 5432))
        db_name = os.getenv('DB_NAME', 'players')

        # Create database engine
        engine = create_engine(f'postgresql+psycopg2://{db_username}:{db_password}@{db_host}:{db_port}/{db_name}')
        
        # Process and upsert data
        aggregated_df = process_and_upsert_data(engine, file_pattern)

        # Optionally return some of the aggregated data for verification
        return jsonify({
            "message": "Data processed and upserted successfully.",
            "data": aggregated_df.head().to_dict(orient='records')  # Return a sample of the DataFrame
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
