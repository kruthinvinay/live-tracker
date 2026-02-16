import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/foundation.dart';

class SocketService {
  // Singleton Pattern
  static final SocketService _instance = SocketService._internal();
  factory SocketService() => _instance;
  SocketService._internal();

  IO.Socket? _socket;
  final String serverUrl = 'https://spyglass-server-h7pe.onrender.com';

  // Callbacks
  Function(String)? onError;
  Function()? onConnect;
  Function()? onJoinSuccess;
  Function()? onPartnerConnected;
  Function()? onPartnerDisconnected;
  Function(double lat, double lng)? onUpdateMap;
  Function()? onWakeUp;
  Function(double lat, double lng, String phone)? onReceiveAlert;

  bool get isConnected => _socket?.connected ?? false;

  void connect(String roomCode) {
    if (roomCode.isEmpty) {
      onError?.call("Please Enter Room Code");
      return;
    }

    // Prevent duplicate connection if already connected
    if (_socket != null) {
      if (_socket!.connected) {
        // If already connected, just join the room again to be sure
        _socket!.emit('join', roomCode);
        return;
      }
      // If socket exists but disconnected, it might reconnect automatically, 
      // but let's ensure we are clean.
      _socket!.dispose(); 
    }

    _socket = IO.io(serverUrl, IO.OptionBuilder()
        .setTransports(['websocket'])
        .enableAutoConnect()
        .enableReconnection()
        .build());

    _socket!.onConnect((_) {
      if (kDebugMode) print('Connected to Socket Server');
      onConnect?.call();
      _socket!.emit('join', roomCode);
    });

    _socket!.on('join_success', (_) {
      onJoinSuccess?.call();
    });

    _socket!.on('error', (msg) {
      onError?.call(msg.toString());
    });

    _socket!.on('partner_connected', (_) {
      onPartnerConnected?.call();
    });

    _socket!.on('partner_disconnected', (_) {
      onPartnerDisconnected?.call();
    });

    _socket!.on('update_map', (data) {
      if (data != null && data['latitude'] != null && data['longitude'] != null) {
        onUpdateMap?.call(
          double.parse(data['latitude'].toString()), 
          double.parse(data['longitude'].toString())
        );
      }
    });

    _socket!.on('wake_up_and_send_location', (_) {
      onWakeUp?.call();
    });

    _socket!.on('receive_alert', (data) {
       if (data != null && data['location'] != null) {
         var loc = data['location'];
         var phone = data['phoneNumber'] ?? '';
         onReceiveAlert?.call(
           double.parse(loc['latitude'].toString()), 
           double.parse(loc['longitude'].toString()),
           phone.toString()
         );
       }
    });

    _socket!.onDisconnect((_) {
      if (kDebugMode) print('Disconnected');
    });
  }

  void sendLocation(String roomCode, double lat, double lng) {
    _socket?.emit('send_location', {
      'roomCode': roomCode,
      'location': {'latitude': lat, 'longitude': lng}
    });
  }

  void requestLocation(String roomCode) {
    _socket?.emit('request_location', roomCode);
  }

  void sendEmergencyAlert(String roomCode, double lat, double lng, String phone) {
    _socket?.emit('emergency_alert', {
      'roomCode': roomCode,
      'location': {'latitude': lat, 'longitude': lng},
      'phoneNumber': phone
    });
  }

  void stopTracking(String roomCode) {
    _socket?.emit('stop_tracking', roomCode);
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null; // Clear instance to allow fresh reconnect if needed later
  }
}
