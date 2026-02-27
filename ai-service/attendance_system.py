#!/usr/bin/env python3
"""
Enhanced Face Recognition Attendance System
With Advanced Features - COMPLETE FIXED VERSION
"""
import base64
import cv2
import face_recognition
import numpy as np
import os
import pickle
import csv
import json
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime, timedelta
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Set backend for non-interactive
import matplotlib.pyplot as plt
import threading
import time
import hashlib
import shutil
import warnings
warnings.filterwarnings('ignore')

class EnhancedAttendanceSystem:
    def __init__(self):
        """Initialize all components"""
        # Initialize all lists properly
        self.known_face_encodings = []
        self.known_face_names = []
        self.known_face_ids = []
        self.known_face_departments = []
        self.known_face_email = []
        self.known_face_phone = []
        
        # Attendance tracking
        self.attendance_log = {}
        self.current_session = []
        self.daily_stats = {}
        
        # System settings
        self.settings = self.load_settings()
        self.recognition_threshold = self.settings.get('recognition_threshold', 0.6)
        self.processing_interval = self.settings.get('processing_interval', 2)
        
        # Camera
        self.cap = None
        self.camera_running = False
        self.recognition_active = False
        
        # Database connection
        self.setup_database()
        
        # AUTO DB MIGRATION (ADD owner_id) - STEP 3
        # ================================
        try:
            self.cursor.execute("PRAGMA table_info(users)")
            columns = [col[1] for col in self.cursor.fetchall()]

            if "owner_id" not in columns:
                print("⚙️ Adding owner_id column to users table...")
                self.cursor.execute(
                    "ALTER TABLE users ADD COLUMN owner_id TEXT"
                )
                self.conn.commit()
                print("✅ owner_id column added")
            else:
                print("✅ owner_id column already exists")

        except Exception as e:
            print("❌ Migration error:", e)
        # ================================
        
        # Load data
        self.load_encodings()
        self.load_todays_attendance()
        
        print(f"✅ Enhanced Attendance System Initialized")
        print(f"📊 Loaded {len(self.known_face_names)} known faces")
    
    def setup_database(self):
        """Setup SQLite database for better data management"""
        self.conn = sqlite3.connect('attendance_system.db', check_same_thread=False)
        self.cursor = self.conn.cursor()
        
        # Create tables if they don't exist - UPDATED with owner_id
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT,
                email TEXT,
                phone TEXT,
                registration_date TEXT,
                last_seen TEXT,
                total_attendance INTEGER DEFAULT 0
            )
        ''')
        
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                name TEXT,
                timestamp TEXT,
                date TEXT,
                status TEXT,
                confidence REAL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS system_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                event TEXT,
                details TEXT
            )
        ''')
        
        self.conn.commit()
        print("✅ Database setup complete")
    
    def load_settings(self):
        """Load system settings from JSON file"""
        default_settings = {
            'recognition_threshold': 0.6,
            'processing_interval': 2,
            'auto_email_report': False,
            'email_recipients': [],
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': 587,
            'email_enabled': False,
            'email_user': '',
            'email_password': '',
            'email_sender': 'attendance@system.com',
            'smtp_configured': False,
            'working_hours_start': '09:00',
            'working_hours_end': '18:00',
            'late_threshold': '09:15',
            'enable_notifications': True,
            'backup_frequency': 24,
            'max_storage_days': 90
        }
        
        try:
            if os.path.exists('settings.json'):
                with open('settings.json', 'r') as f:
                    loaded = json.load(f)
                    default_settings.update(loaded)
                    print("✅ Settings loaded from file")
            else:
                self.save_settings(default_settings)
                print("✅ Default settings created")
        except Exception as e:
            print(f"⚠️ Error loading settings: {e}")
            self.save_settings(default_settings)
        
        return default_settings
    
    def save_settings(self, settings=None):
        """Save system settings to JSON file"""
        if settings:
            self.settings = settings
        try:
            with open('settings.json', 'w') as f:
                json.dump(self.settings, f, indent=4)
            print("✅ Settings saved")
        except Exception as e:
            print(f"⚠️ Error saving settings: {e}")
    
    def load_encodings(self):
        """Load face encodings from database and file"""
        try:
            if os.path.exists('face_encodings.pkl'):
                with open('face_encodings.pkl', 'rb') as f:
                    data = pickle.load(f)
                    self.known_face_encodings = data.get('encodings', [])
                    self.known_face_names = data.get('names', [])
                    self.known_face_ids = data.get('ids', [])
                    self.known_face_departments = data.get('departments', [])
                    self.known_face_email = data.get('emails', [])
                    self.known_face_phone = data.get('phones', [])
                print(f"✅ Loaded {len(self.known_face_names)} faces from file")
            
            self.sync_with_database()
        except Exception as e:
            print(f"⚠️ Error loading encodings: {e}")
    
    def sync_with_database(self):
        """Sync loaded data with database"""
        try:
            for i, user_id in enumerate(self.known_face_ids):
                self.cursor.execute('''
                    INSERT OR REPLACE INTO users (id, name, department, email, phone, registration_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    user_id, 
                    self.known_face_names[i] if i < len(self.known_face_names) else 'Unknown',
                    self.known_face_departments[i] if i < len(self.known_face_departments) else 'Unknown',
                    self.known_face_email[i] if i < len(self.known_face_email) else '',
                    self.known_face_phone[i] if i < len(self.known_face_phone) else '',
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                ))
            self.conn.commit()
        except Exception as e:
            print(f"⚠️ Error syncing with database: {e}")
    
    def load_todays_attendance(self):
        """Load today's attendance records"""
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            self.cursor.execute('''
                SELECT user_id, name, timestamp FROM attendance 
                WHERE date = ? ORDER BY timestamp
            ''', (today,))
            
            self.attendance_log = {}
            for record in self.cursor.fetchall():
                if record[0] not in self.attendance_log:
                    self.attendance_log[record[0]] = {
                        'name': record[1],
                        'timestamp': record[2],
                        'status': 'Present'
                    }
        except Exception as e:
            print(f"⚠️ Error loading today's attendance: {e}")
    
    def mark_attendance(self, user_id, name, confidence):
        """Mark attendance with enhanced tracking"""
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        
        self.cursor.execute('''
            SELECT id, timestamp FROM attendance 
            WHERE user_id = ? AND date = ? 
            ORDER BY timestamp DESC LIMIT 1
        ''', (user_id, date_str))
        
        existing = self.cursor.fetchone()
        
        if existing:
            last_time = datetime.strptime(existing[1], "%Y-%m-%d %H:%M:%S")
            
            if (now - last_time).seconds < 300:
                return "duplicate"
        
        try:
            working_start = datetime.strptime(f"{date_str} {self.settings['working_hours_start']}", "%Y-%m-%d %H:%M")
            late_threshold = datetime.strptime(f"{date_str} {self.settings['late_threshold']}", "%Y-%m-%d %H:%M")
            
            if now < working_start:
                status = "Early"
            elif now <= late_threshold:
                status = "On Time"
            else:
                status = "Late"
        except:
            status = "Present"
        
        self.cursor.execute('''
            INSERT INTO attendance (user_id, name, timestamp, date, status, confidence)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, name, now.strftime("%Y-%m-%d %H:%M:%S"), date_str, status, confidence))
        
        self.cursor.execute('''
            UPDATE users SET last_seen = ?, total_attendance = total_attendance + 1
            WHERE id = ?
        ''', (now.strftime("%Y-%m-%d %H:%M:%S"), user_id))
        
        self.conn.commit()
        
        if user_id not in self.attendance_log:
            self.attendance_log[user_id] = {
                'name': name,
                'timestamp': time_str,
                'status': status
            }
        
        return status
    
    def process_frame_for_service(self, frame):
        """Process frame for recognition service"""
        try:
            small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
            
            face_locations = face_recognition.face_locations(rgb_small_frame)
            face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)
            
            results = []
            for face_encoding, face_location in zip(face_encodings, face_locations):
                top, right, bottom, left = [v * 2 for v in face_location]
                
                if len(self.known_face_encodings) > 0:
                    matches = face_recognition.compare_faces(
                        self.known_face_encodings, face_encoding, 
                        tolerance=self.recognition_threshold
                    )
                    face_distances = face_recognition.face_distance(
                        self.known_face_encodings, face_encoding
                    )
                    
                    if True in matches:
                        best_match_index = np.argmin(face_distances)
                        confidence = 1 - face_distances[best_match_index]
                        
                        if confidence >= self.recognition_threshold:
                            name = self.known_face_names[best_match_index]
                            user_id = self.known_face_ids[best_match_index]
                            
                            status = self.mark_attendance(user_id, name, confidence)
                            
                            face_crop = frame[top:bottom, left:right]

                            _, buffer = cv2.imencode('.jpg', face_crop)
                            face_base64 = base64.b64encode(buffer).decode('utf-8')

                            results.append({
                                'success': True,
                                'name': name,
                                'userId': user_id,
                                'department': self.known_face_departments[best_match_index]
                                    if best_match_index < len(self.known_face_departments) else '',
                                'confidence': float(confidence),
                                'status': status,
                                'bbox': [top, right, bottom, left],
                                'image': f"data:image/jpeg;base64,{face_base64}"
                            })
                        else:
                            results.append({
                                'success': False,
                                'message': 'Low confidence',
                                'confidence': float(confidence),
                                'bbox': [top, right, bottom, left]
                            })
                    else:
                        results.append({
                            'success': False,
                            'message': 'Unknown face',
                            'bbox': [top, right, bottom, left]
                        })
                else:
                    results.append({
                        'success': False,
                        'message': 'No training data',
                        'bbox': [top, right, bottom, left]
                    })
            
            return results[0] if results else None
            
        except Exception as e:
            print(f"Error processing frame: {e}")
            return None
    
    def get_user_total_attendance(self, user_id):
        """Get total attendance count for a user"""
        try:
            self.cursor.execute('SELECT total_attendance FROM users WHERE id = ?', (user_id,))
            result = self.cursor.fetchone()
            return result[0] if result else 0
        except:
            return 0
    
    def get_user_last_seen(self, user_id):
        """Get last seen timestamp for a user"""
        try:
            self.cursor.execute('SELECT last_seen FROM users WHERE id = ?', (user_id,))
            result = self.cursor.fetchone()
            return result[0] if result else 'Never'
        except:
            return 'Never'
    
    def save_encodings(self):
        """Save face encodings to file"""
        try:
            data = {
                'encodings': self.known_face_encodings,
                'names': self.known_face_names,
                'ids': self.known_face_ids,
                'departments': self.known_face_departments,
                'emails': self.known_face_email,
                'phones': self.known_face_phone
            }
            with open('face_encodings.pkl', 'wb') as f:
                pickle.dump(data, f)
            print(f"✅ Saved {len(self.known_face_names)} face encodings")
        except Exception as e:
            print(f"⚠️ Error saving encodings: {e}")

def main():
    print("=" * 60)
    print("ENHANCED FACE RECOGNITION ATTENDANCE SYSTEM")
    print("Version 2.0")
    print("=" * 60)
    
    dirs = ['known_faces', 'exports', 'backups', 'logs', 'models']
    for dir_name in dirs:
        if not os.path.exists(dir_name):
            os.makedirs(dir_name)
            print(f"✅ Created directory: {dir_name}")
    
    system = EnhancedAttendanceSystem()
    
    print("\n📋 System ready!")
    print("To start the AI service, run: python ai_server.py")

if __name__ == "__main__":
    main()