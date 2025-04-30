from flask import Flask, jsonify, request
from flask_cors import CORS 
from flask_socketio import SocketIO, emit 
from simulated_bots import mock_bots
import time
import threading
import json
from config import Config

# Initialize Flask
app = Flask(__name__)
CORS(app)

# Initialize SocketIO with CORS
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Store frequency data
target_frequency = {
    "value": 440,
    "timestamp": time.time()
}

# Real-time data emitter
def emit_bot_status():
    """Periodically emit bot status via WebSocket"""
    while True:
        # Get current bot states
        bot_data = [{"id": k, **v} for k, v in mock_bots.items()]
        
        # Emit to connected clients
        socketio.emit('bot_update', json.dumps(bot_data))
        
        # Sleep for 1 second
        socketio.sleep(1)

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connection"""
    print('Client connected')
    emit('status', {'data': 'Connected to server'})
    emit('frequency_update', target_frequency)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    print('Client disconnected')

@socketio.on('set_frequency')
def handle_set_frequency(data):
    """Handle frequency setting via WebSocket"""
    try:
        frequency = float(data.get('frequency', 440))
        target_frequency['value'] = frequency
        target_frequency['timestamp'] = time.time()
        
        # Broadcast to all clients
        socketio.emit('frequency_update', target_frequency)
        
        return {'status': 'success', 'frequency': frequency}
    except (ValueError, TypeError) as e:
        return {'status': 'error', 'message': str(e)}

# Flask endpoints
@app.route('/get_bot_states', methods=['GET'])
def get_bot_states():
    """Get all bot states"""
    return jsonify([{"id": k, **v} for k, v in mock_bots.items()])

@app.route('/set_frequency', methods=['POST'])
def set_frequency():
    """Set target frequency via REST API"""
    if not request.is_json:
        return jsonify({"error": "Missing JSON"}), 400
        
    data = request.get_json()
    if "frequency" not in data:
        return jsonify({"error": "Missing frequency"}), 400
    
    try:
        frequency = float(data["frequency"])
        if frequency <= 0:
            return jsonify({"error": "Frequency must be positive"}), 400
            
        # Update frequency
        target_frequency['value'] = frequency
        target_frequency['timestamp'] = time.time()
        
        # Broadcast via WebSocket
        socketio.emit('frequency_update', target_frequency)
        
        return jsonify({
            "status": "success",
            "frequency": frequency
        })
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid frequency value"}), 400

@app.route('/get_frequency', methods=['GET'])
def get_frequency():
    """Get current target frequency"""
    return jsonify(target_frequency)

# Run the Socket.IO server
if __name__ == '__main__':
    # Start the background thread for periodic updates
    socketio_thread = threading.Thread(target=emit_bot_status)
    socketio_thread.daemon = True
    socketio_thread.start()
    
    # Run the Flask application
    socketio.run(
        app, 
        host=Config.API_HOST, 
        port=Config.FLASK_PORT,
        debug=Config.DEBUG
    )
