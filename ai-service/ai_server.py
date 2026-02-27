#!/usr/bin/env python3
"""
Face Recognition AI Service
Using the Enhanced Attendance System as a backend service
"""
import base64
import os
import sys
import requests
import json
import base64
import threading
import queue
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import numpy as np
import face_recognition
from attendance_system import EnhancedAttendanceSystem
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5000"
])
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=60, ping_interval=25)

# Initialize the attendance system
attendance_system = EnhancedAttendanceSystem()

# Queue for processing frames
frame_queue = queue.Queue(maxsize=10)
processing_thread = None
is_processing = False

def process_frames():
    """Background thread to process frames"""
    global is_processing

    print("🧠 Frame processor started")

    while is_processing:
        try:
            frame_data = frame_queue.get(timeout=5)

            print("📸 Processing frame...")

            if frame_data is None:
                continue

            # 🔥 Run recognition
            result = attendance_system.process_frame_for_service(frame_data)

            # ===============================
            # ✅ HARD VALIDATION (VERY IMPORTANT)
            # ===============================
            if not result:
                continue

            user_id = result.get("userId")
            name = result.get("name")

            # 🚨 DO NOT SEND EMPTY RESULTS
            if not user_id or not name:
                print("⛔ Ignored invalid detection")
                continue

            # ignore duplicates
            if result.get("status") in ["duplicate", "already_marked"]:
                continue

            # =====================================================
            # FIX 1 & 2: Get owner_id from DB and send to both endpoints
            # =====================================================
            try:
                # Get owner_id from database
                attendance_system.cursor.execute(
                    "SELECT owner_id FROM users WHERE id = ?",
                    (result.get("userId"),)
                )
                row = attendance_system.cursor.fetchone()
                owner_id = row[0] if row else None
                
                print(f"📡 Sending result to Node backend with owner_id: {owner_id}...")

                # FIX 1: Send owner_id to ai-result endpoint
                requests.post(
                    "http://localhost:5000/api/attendance/ai-result",
                    json={
                        "success": True,
                        "ownerId": owner_id,  # ⭐ CRITICAL FIX
                        "name": result.get("name"),
                        "userId": result.get("userId"),
                        "department": result.get("department"),
                        "confidence": result.get("confidence"),
                        "status": result.get("status"),
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=5
                )

                print("✅ Result sent to Node")

                # FIX 2: Send owner_id to mark attendance endpoint
                requests.post(
                    "http://localhost:5000/api/attendance/mark",
                    json={
                        "ownerId": owner_id,  # ⭐ CRITICAL FIX
                        "userId": result.get("userId"),
                        "name": result.get("name"),
                        "status": result.get("status"),
                        "confidence": result.get("confidence"),
                        "method": "face"
                    },
                    headers={"Content-Type": "application/json"},
                    timeout=2
                )
                print("✅ Attendance marked via backend")

            except Exception as e:
                print("❌ Backend API failed:", e)

        except queue.Empty:
            continue

        except Exception as e:
            print(f"❌ Frame processing error: {e}")
            
@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'faces_loaded': len(attendance_system.known_face_names),
        'service': 'Enhanced Attendance System'
    })

@app.route('/register-face', methods=['POST'])
def register_face():
    """Register a new face using the enhanced system"""
    try:
        data = request.json
        name = data.get('name')
        user_id = data.get('userId')
        owner_id = data.get('ownerId')
        department = data.get('department')
        email = data.get('email')
        phone = data.get('phone')
        image_data = data.get('image')
        
        if not all([name, user_id, image_data]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Decode base64 image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        if len(face_locations) == 0:
            return jsonify({'error': 'No face detected'}), 400
        
        if len(face_locations) > 1:
            return jsonify({'error': f'Found {len(face_locations)} faces. Need exactly 1'}), 400
        
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        if not face_encodings:
            return jsonify({'error': 'Could not encode face'}), 400
        
        if user_id in attendance_system.known_face_ids:
            return jsonify({'error': 'User ID already exists'}), 400
        
        attendance_system.known_face_encodings.append(face_encodings[0])
        attendance_system.known_face_names.append(name)
        attendance_system.known_face_ids.append(user_id)
        attendance_system.known_face_departments.append(department or '')
        attendance_system.known_face_email.append(email or '')
        attendance_system.known_face_phone.append(phone or '')
        
        # Insert user with owner_id
        attendance_system.cursor.execute('''
            INSERT INTO users (id, owner_id, name, department, email, phone, registration_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            owner_id,
            name,
            department or '',
            email or '',
            phone or '',
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        attendance_system.conn.commit()
        
        os.makedirs('known_faces', exist_ok=True)
        face_image_path = f"known_faces/{user_id}_{name}.jpg"
        cv2.imwrite(face_image_path, frame)
        
        attendance_system.save_encodings()
        
        socketio.emit('face-registered', {
            'name': name,
            'userId': user_id,
            'timestamp': datetime.now().isoformat()
        })
        
        return jsonify({
            'success': True,
            'message': f'Successfully registered {name}',
            'userId': user_id
        })
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize_face():
    """Recognize a face using the enhanced system"""
    try:
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image provided'}), 400
        
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locations = face_recognition.face_locations(rgb_frame)
        
        if len(face_locations) == 0:
            return jsonify({
                'success': False,
                'message': 'No face detected'
            })
        
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        
        if not face_encodings:
            return jsonify({
                'success': False,
                'message': 'Could not encode face'
            })
        
        results = []
        for face_encoding in face_encodings:
            if len(attendance_system.known_face_encodings) > 0:
                matches = face_recognition.compare_faces(
                    attendance_system.known_face_encodings, 
                    face_encoding, 
                    tolerance=attendance_system.recognition_threshold
                )
                face_distances = face_recognition.face_distance(
                    attendance_system.known_face_encodings, 
                    face_encoding
                )
                
                if True in matches:
                    best_match_index = np.argmin(face_distances)
                    confidence = 1 - face_distances[best_match_index]
                    
                    if confidence >= attendance_system.recognition_threshold:
                        name = attendance_system.known_face_names[best_match_index]
                        user_id = attendance_system.known_face_ids[best_match_index]
                        
                        status = attendance_system.mark_attendance(user_id, name, confidence)
                        
                        results.append({
                            'success': True,
                            'name': name,
                            'userId': user_id,
                            'department': attendance_system.known_face_departments[best_match_index] if best_match_index < len(attendance_system.known_face_departments) else '',
                            'confidence': float(confidence),
                            'status': status
                        })
                        
                        socketio.emit('attendance_marked', {
                            'name': name,
                            'userId': user_id,
                            'status': status,
                            'timestamp': datetime.now().isoformat()
                        })
                    else:
                        results.append({
                            'success': False,
                            'message': 'Low confidence match',
                            'confidence': float(confidence)
                        })
                else:
                    results.append({
                        'success': False,
                        'message': 'Unknown face'
                    })
            else:
                results.append({
                    'success': False,
                    'message': 'No training data available'
                })
        
        return jsonify(results[0] if results else {
            'success': False,
            'message': 'No faces processed'
        })
        
    except Exception as e:
        print(f"❌ Recognition error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/recognize-stream', methods=['POST'])
def recognize_stream():
    """Process frame for streaming (adds to queue)"""
    try:
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image provided'}), 400
        
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        if not frame_queue.full():
            frame_queue.put(frame)
        
        return jsonify({'success': True, 'queued': True})
        
    except Exception as e:
        print(f"❌ Stream error: {e}")
        return jsonify({'error': str(e)}), 500

# FIX 3: Completely rewritten /known-faces endpoint
@app.route('/known-faces', methods=['GET'])
def get_known_faces():
    """Get list of known faces filtered by ownerId"""
    owner_id = request.args.get('ownerId')
    
    # Query based on owner_id filter
    if owner_id:
        attendance_system.cursor.execute(
            "SELECT id, name, department, email, phone FROM users WHERE owner_id = ?",
            (owner_id,)
        )
    else:
        attendance_system.cursor.execute(
            "SELECT id, name, department, email, phone FROM users"
        )
    
    rows = attendance_system.cursor.fetchall()
    faces = []
    
    for row in rows:
        uid, name, dept, email, phone = row
        
        faces.append({
            "userId": uid,
            "name": name,
            "department": dept,
            "email": email,
            "phone": phone,
            "totalAttendance": attendance_system.get_user_total_attendance(uid),
            "lastSeen": attendance_system.get_user_last_seen(uid)
        })
    
    return jsonify({
        "count": len(faces),
        "faces": faces,
        "stats": {
            "today": len(attendance_system.attendance_log),
            "total": len(attendance_system.known_face_names)
        }
    })

@app.route('/face/<user_id>', methods=['DELETE'])
def delete_face(user_id):
    """Delete a face by user ID"""
    try:
        if user_id in attendance_system.known_face_ids:
            idx = attendance_system.known_face_ids.index(user_id)
            name = attendance_system.known_face_names[idx]
            
            attendance_system.cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
            attendance_system.cursor.execute('DELETE FROM attendance WHERE user_id = ?', (user_id,))
            attendance_system.conn.commit()
            
            if idx < len(attendance_system.known_face_encodings):
                del attendance_system.known_face_encodings[idx]
            if idx < len(attendance_system.known_face_names):
                del attendance_system.known_face_names[idx]
            if idx < len(attendance_system.known_face_ids):
                del attendance_system.known_face_ids[idx]
            if idx < len(attendance_system.known_face_departments):
                del attendance_system.known_face_departments[idx]
            if idx < len(attendance_system.known_face_email):
                del attendance_system.known_face_email[idx]
            if idx < len(attendance_system.known_face_phone):
                del attendance_system.known_face_phone[idx]
            
            import glob
            for file in glob.glob(f"known_faces/{user_id}_*.jpg"):
                os.remove(file)
            
            attendance_system.save_encodings()
            
            socketio.emit('face_deleted', {
                'userId': user_id,
                'name': name
            })
            
            return jsonify({
                'success': True,
                'message': f'Face for user {name} deleted'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
            
    except Exception as e:
        print(f"❌ Delete error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/attendance/today', methods=['GET'])
def get_today_attendance():
    """Get today's attendance records"""
    try:
        attendance_system.cursor.execute('''
            SELECT strftime('%H:%M:%S', timestamp), user_id, name, status, confidence
            FROM attendance 
            WHERE date = ? 
            ORDER BY timestamp DESC
        ''', (datetime.now().strftime("%Y-%m-%d"),))
        
        records = []
        for record in attendance_system.cursor.fetchall():
            records.append({
                'time': record[0],
                'userId': record[1],
                'name': record[2],
                'status': record[3],
                'confidence': record[4]
            })
        
        return jsonify(records)
        
    except Exception as e:
        print(f"❌ Error getting today's attendance: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/attendance/range', methods=['GET'])
def get_attendance_range():
    """Get attendance records for a date range"""
    try:
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        
        if not start_date or not end_date:
            return jsonify({'error': 'Start date and end date required'}), 400
        
        attendance_system.cursor.execute('''
            SELECT timestamp, user_id, name, status, confidence
            FROM attendance 
            WHERE date BETWEEN ? AND ?
            ORDER BY timestamp DESC
        ''', (start_date, end_date))
        
        records = []
        for record in attendance_system.cursor.fetchall():
            records.append({
                'timestamp': record[0],
                'userId': record[1],
                'name': record[2],
                'status': record[3],
                'confidence': record[4]
            })
        
        return jsonify(records)
        
    except Exception as e:
        print(f"❌ Error getting attendance range: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/settings', methods=['GET', 'POST'])
def handle_settings():
    """Get or update settings"""
    if request.method == 'GET':
        return jsonify(attendance_system.settings)
    else:
        data = request.json
        attendance_system.settings.update(data)
        attendance_system.save_settings()
        attendance_system.recognition_threshold = attendance_system.settings.get('recognition_threshold', 0.6)
        return jsonify({'success': True, 'settings': attendance_system.settings})

@app.route('/statistics', methods=['GET'])
def get_statistics():
    """Get system statistics"""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        
        attendance_system.cursor.execute('SELECT COUNT(*) FROM attendance WHERE date = ?', (today,))
        today_count = attendance_system.cursor.fetchone()[0]
        
        attendance_system.cursor.execute('SELECT COUNT(*) FROM users')
        total_users = attendance_system.cursor.fetchone()[0]
        
        attendance_system.cursor.execute('''
            SELECT status, COUNT(*) FROM attendance 
            WHERE date = ? GROUP BY status
        ''', (today,))
        status_dist = [{"status": row[0], "count": row[1]} for row in attendance_system.cursor.fetchall()]
        
        attendance_system.cursor.execute('''
            SELECT department, COUNT(*) FROM users 
            WHERE department IS NOT NULL GROUP BY department
        ''')
        dept_dist = [{"department": row[0], "count": row[1]} for row in attendance_system.cursor.fetchall()]
        
        return jsonify({
            'today': today_count,
            'totalUsers': total_users,
            'statusDistribution': status_dist,
            'departmentDistribution': dept_dist,
            'knownFaces': len(attendance_system.known_face_names)
        })
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/start-recognition', methods=['POST'])
def start_recognition():
    global is_processing, processing_thread

    print("🚀 START RECOGNITION CALLED")

    # stop old thread safely
    is_processing = False

    if processing_thread and processing_thread.is_alive():
        print("♻️ Restarting recognition thread")

    is_processing = True
    processing_thread = threading.Thread(
        target=process_frames,
        daemon=True
    )
    processing_thread.start()

    attendance_system.recognition_active = True

    print("✅ Recognition thread running")

    return jsonify({
        "success": True,
        "message": "Recognition started"
    })    

@app.route('/stop-recognition', methods=['POST'])
def stop_recognition():
    """Stop the recognition process"""
    global is_processing
    
    is_processing = False
    attendance_system.recognition_active = False
    
    while not frame_queue.empty():
        try:
            frame_queue.get_nowait()
        except:
            break
    
    return jsonify({'success': True, 'message': 'Recognition stopped'})

@socketio.on('connect')
def handle_connect():
    print('✅ Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('❌ Client disconnected')

if __name__ == '__main__':
    print("=" * 60)
    print("ENHANCED FACE RECOGNITION AI SERVICE")
    print("=" * 60)
    print(f"✅ Loaded {len(attendance_system.known_face_names)} known faces")
    print("🚀 Starting Flask server on port 5001...")
    
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, allow_unsafe_werkzeug=True)