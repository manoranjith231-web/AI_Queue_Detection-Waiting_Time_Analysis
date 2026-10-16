import datetime
import random
from typing import List, Dict, Any
from backend.app.database import get_db_connection

class DemoDataGenerator:
    @staticmethod
    def populate_historical_dataset(days: int = 3) -> int:
        """
        Populates SQLite with realistic supermarket hourly aggregate queue data.
        Models typical supermarket patterns:
        - Morning opening lull (8am - 10am)
        - Lunch mini-rush (12pm - 2pm)
        - Afternoon quiet (2pm - 4:30pm)
        - Evening rush hour peak (5pm - 8:30pm)
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Clear existing simulated measurements
        cursor.execute("DELETE FROM queue_measurements WHERE is_simulated = 1")
        
        now = datetime.datetime.now()
        records = []
        
        for d in range(days, -1, -1):
            date_base = now - datetime.timedelta(days=d)
            for hour in range(8, 22): # 8 AM to 10 PM operating hours
                # Compute hour peak multiplier
                if 12 <= hour <= 14:
                    rush = 1.7 # Lunch peak
                elif 17 <= hour <= 20:
                    rush = 2.4 # Evening rush hour peak
                elif hour < 10 or hour > 20:
                    rush = 0.6 # Early/late lull
                else:
                    rush = 1.1 # Steady afternoon
                
                # Counters 1, 2, 3
                # Counter 1: Express (fast throughput, 1-4 people)
                c1_cnt = max(0, int(random.gauss(2.2 * rush, 0.8)))
                c1_wait = c1_cnt * 90.0
                c1_cong = "Critical" if c1_cnt >= 5 else ("Warning" if c1_cnt >= 3 else "Normal")
                
                # Counter 2: Regular (moderate, 2-6 people)
                c2_cnt = max(0, int(random.gauss(3.0 * rush, 1.1)))
                c2_wait = c2_cnt * 135.0
                c2_cong = "Critical" if c2_cnt >= 6 else ("Warning" if c2_cnt >= 4 else "Normal")
                
                # Counter 3: Bulk / Trolley (higher wait, 1-5 people)
                c3_cnt = max(0, int(random.gauss(2.5 * rush, 0.9)))
                c3_wait = c3_cnt * 180.0
                c3_cong = "Critical" if c3_cnt >= 6 else ("Warning" if c3_cnt >= 5 else "Normal")
                
                t_str = date_base.replace(hour=hour, minute=random.randint(0, 59), second=0).strftime("%Y-%m-%d %H:%M:%S")
                
                records.append((t_str, 1, c1_cnt, c1_wait, c1_cong, 15.0, 1))
                records.append((t_str, 2, c2_cnt, c2_wait, c2_cong, 15.0, 1))
                records.append((t_str, 3, c3_cnt, c3_wait, c3_cong, 15.0, 1))

        cursor.executemany("""
        INSERT INTO queue_measurements (timestamp, counter_id, people_count, estimated_wait_time_sec, congestion_level, fps, is_simulated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, records)
        
        conn.commit()
        count = len(records)
        conn.close()
        return count
