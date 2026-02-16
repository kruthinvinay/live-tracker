import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MapLocation {
    latitude: number;
    longitude: number;
}

interface OpenStreetMapProps {
    myLocation?: MapLocation | null;
    friendLocation?: MapLocation | null;
    style?: any;
}

export const OpenStreetMap = ({ myLocation, friendLocation, style }: OpenStreetMapProps) => {
    const webViewRef = useRef<WebView>(null);

    // Update markers when locations change
    useEffect(() => {
        if (webViewRef.current) {
            const js = `
        if (typeof updateMarkers === 'function') {
          updateMarkers(
            ${myLocation ? `{lat: ${myLocation.latitude}, lng: ${myLocation.longitude}}` : 'null'},
            ${friendLocation ? `{lat: ${friendLocation.latitude}, lng: ${friendLocation.longitude}}` : 'null'}
          );
        }
        true;
      `;
            webViewRef.current.injectJavaScript(js);
        }
    }, [myLocation?.latitude, myLocation?.longitude, friendLocation?.latitude, friendLocation?.longitude]);

    const myLat = myLocation?.latitude || 20.5937;
    const myLng = myLocation?.longitude || 78.9629;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView([${myLat}, ${myLng}], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Custom icons
    var myIcon = L.divIcon({
      html: '<div style="background:#4285F4;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      className: ''
    });

    var friendIcon = L.divIcon({
      html: '<div style="background:#EA4335;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      className: ''
    });

    var myMarker = null;
    var friendMarker = null;
    var firstCenter = true;

    function updateMarkers(myLoc, friendLoc) {
      // Update my location
      if (myLoc) {
        if (myMarker) {
          myMarker.setLatLng([myLoc.lat, myLoc.lng]);
        } else {
          myMarker = L.marker([myLoc.lat, myLoc.lng], { icon: myIcon }).addTo(map);
          myMarker.bindPopup('Me');
        }
        if (firstCenter) {
          map.setView([myLoc.lat, myLoc.lng], 15);
          firstCenter = false;
        }
      }

      // Update friend location
      if (friendLoc) {
        if (friendMarker) {
          friendMarker.setLatLng([friendLoc.lat, friendLoc.lng]);
        } else {
          friendMarker = L.marker([friendLoc.lat, friendLoc.lng], { icon: friendIcon }).addTo(map);
          friendMarker.bindPopup('Partner');
        }
      }
    }
  </script>
</body>
</html>
  `;

    return (
        <View style={[styles.container, style]}>
            <WebView
                ref={webViewRef}
                source={{ html }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
});
