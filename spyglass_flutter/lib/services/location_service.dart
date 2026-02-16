import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:flutter/foundation.dart';

class LocationService {
  StreamSubscription<Position>? _positionStreamSubscription;
  final Function(Position) onLocationUpdate;

  LocationService({required this.onLocationUpdate});

  Future<bool> checkPermission() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (kDebugMode) print('Location services are disabled.');
      return false;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (kDebugMode) print('Location permissions are denied');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      if (kDebugMode) print('Location permissions are permanently denied, we cannot request permissions.');
      return false;
    }

    return true;
  }

  Future<Position?> getCurrentLocation() async {
    if (!await checkPermission()) return null;
    return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation);
  }

  Future<void> startTracking() async {
    if (!await checkPermission()) return;

    const LocationSettings locationSettings = LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 0, // Update every change
    );

    // For Android Foreground Service, specific settings would be needed here usually
    // typically handled by flutter_background_service or background_locator
    // However, geolocator stream works while app is in foreground and often background if correct permissions are set.

    _positionStreamSubscription = Geolocator.getPositionStream(locationSettings: locationSettings).listen(
      (Position position) {
        if (kDebugMode) print(position == null ? 'Unknown' : '${position.latitude}, ${position.longitude}');
        onLocationUpdate(position);
      },
    );
  }

  void stopTracking() {
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
  }
}
