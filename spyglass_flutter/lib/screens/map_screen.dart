import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/socket_service.dart';
import '../services/location_service.dart';
import 'package:geolocator/geolocator.dart';

class MapScreen extends StatefulWidget {
  final String roomCode;

  const MapScreen({super.key, required this.roomCode});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final Completer<GoogleMapController> _controller = Completer();
  late SocketService _socketService;
  late LocationService _locationService;
  
  // Locations
  LatLng? _myLocation;
  LatLng? _partnerLocation;

  // UI State
  bool _isPartnerOnline = false;
  Set<Marker> _markers = {};

  @override
  void initState() {
    super.initState();
    _initializeServices();
  }

  void _initializeServices() {
    // 1. Setup Location Service
    _locationService = LocationService(onLocationUpdate: (Position pos) {
      if (!mounted) return;
      setState(() {
        _myLocation = LatLng(pos.latitude, pos.longitude);
        _updateMarkers();
      });

      // Send update to server
      _socketService.sendLocation(widget.roomCode, pos.latitude, pos.longitude);
      
      // Move camera if first load
      _moveCamera(pos.latitude, pos.longitude);
    });

    _locationService.startTracking();

    // 2. Setup Socket Service
    _socketService = SocketService(); // Returns singleton
    
    // Define Callbacks
    _socketService.onConnect = () {
      if (mounted) _showSnack("Connected to Satellite 📡", Colors.green);
    };

    _socketService.onError = (msg) {
        if (mounted) _showSnack(msg, Colors.red);
        if (msg.contains('Full')) Navigator.pop(context);
    };

    _socketService.onJoinSuccess = () {
       if (mounted) _showSnack("Joined Room: ${widget.roomCode}", Colors.blue);
    };

    _socketService.onPartnerConnected = () {
      if (mounted) {
          setState(() => _isPartnerOnline = true);
          _showSnack("Partner Connected! 🟢", Colors.green);
      }
    };

    _socketService.onPartnerDisconnected = () {
      if (mounted) {
          setState(() => _isPartnerOnline = false);
          _showSnack("Partner Disconnected 🔴", Colors.orange);
      }
    };

    _socketService.onUpdateMap = (lat, lng) {
      if (mounted) {
          setState(() {
            _partnerLocation = LatLng(lat, lng);
            _updateMarkers();
          });
          _showSnack("Target Moved!", Colors.blueAccent);
      }
    };

    _socketService.onWakeUp = () async {
       _showSnack("Tracker pinged you! Sending location...", Colors.purple);
       var pos = await _locationService.getCurrentLocation();
       if (pos != null) {
         _socketService.sendLocation(widget.roomCode, pos.latitude, pos.longitude);
       }
    };

    _socketService.onReceiveAlert = (lat, lng, phone) {
      _showEmergencyDialog(LatLng(lat, lng), phone);
    };

    // Connect
    _socketService.connect(widget.roomCode);
  }

  void _updateMarkers() {
    Set<Marker> newMarkers = {};

    if (_myLocation != null) {
      newMarkers.add(Marker(
        markerId: const MarkerId('me'),
        position: _myLocation!,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        infoWindow: const InfoWindow(title: "Me"),
      ));
    }

    if (_partnerLocation != null) {
      newMarkers.add(Marker(
        markerId: const MarkerId('partner'),
        position: _partnerLocation!,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: const InfoWindow(title: "Target"),
      ));
    }

    setState(() {
      _markers = newMarkers;
    });
  }

  Future<void> _moveCamera(double lat, double lng) async {
    final GoogleMapController controller = await _controller.future;
    controller.animateCamera(CameraUpdate.newCameraPosition(
      CameraPosition(target: LatLng(lat, lng), zoom: 15),
    ));
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: color, duration: const Duration(seconds: 2)),
    );
  }

  void _showEmergencyDialog(LatLng loc, String phone) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("🚨 EMERGENCY ALERT 🚨"),
        content: Text("Friend needs help!\nLocation: ${loc.latitude}, ${loc.longitude}"),
        backgroundColor: Colors.red[50],
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("OK"),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _socketService.disconnect();
    _locationService.stopTracking();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Room: ${widget.roomCode}"),
        actions: [
            Icon(Icons.circle, color: _isPartnerOnline ? Colors.green : Colors.grey),
            const SizedBox(width: 15),
        ],
      ),
      body: GoogleMap(
        initialCameraPosition: const CameraPosition(
          target: LatLng(0, 0),
          zoom: 2,
        ),
        markers: _markers,
        onMapCreated: (GoogleMapController controller) {
          _controller.complete(controller);
        },
        myLocationEnabled: true,
        myLocationButtonEnabled: true,
      ),
      floatingActionButton: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton(
            heroTag: "ping",
            backgroundColor: Colors.blue,
            onPressed: () => _socketService.requestLocation(widget.roomCode),
            child: const Icon(Icons.radar),
          ),
          const SizedBox(height: 10),
          FloatingActionButton(
            heroTag: "sos",
            backgroundColor: Colors.red,
            onPressed: () async {
                var pos = await _locationService.getCurrentLocation();
                if (pos != null) {
                    _socketService.sendEmergencyAlert(widget.roomCode, pos.latitude, pos.longitude, "MyPhone");
                    _showSnack("SOS Signal Sent!", Colors.red);
                }
            },
            child: const Icon(Icons.warning),
          ),
        ],
      ),
    );
  }
}
