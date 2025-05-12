// screens/StudentConnectScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Animated, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '../../config/firebaseconfig';
import { collection, getDoc, doc, setDoc, Timestamp, GeoPoint, getDocs, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getCurrentLocation } from '../../utils/locationHelpers';
import Svg, { Circle, Line } from 'react-native-svg';

const ScanningAnimation = () => {
  const rotation = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotationInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: rotationInterpolate }] }}>
      <Svg height="200" width="200" viewBox="0 0 200 200">
        <Circle cx="100" cy="100" r="80" stroke="#FFA500" strokeWidth="2" fill="none" />
        <Circle cx="100" cy="100" r="50" stroke="#FFA500" strokeWidth="2" fill="none" />
        <Circle cx="100" cy="100" r="20" stroke="#FFA500" strokeWidth="2" fill="none" />
        <Line x1="100" y1="100" x2="100" y2="20" stroke="#FFA500" strokeWidth="2" />
      </Svg>
    </Animated.View>
  );
};

const JoiningAnimation = () => (
  <View style={styles.joiningContainer}>
    <ActivityIndicator size="large" color="#FFA500" />
    <Text style={styles.text}>Joining broadcast...</Text>
  </View>
);

const FindBroadcastScreen = ({ navigation }: any) => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const showAlert = (title: string, message: string) => {
    setAlert({ title, message });
  };

  const closeAlert = () => {
    setAlert(null);
  };

  const fetchNearbyBroadcasts = async () => {
    try {
      const location = await getCurrentLocation();
      const q = query(collection(firestore, 'broadcasts'), where('isActive', '==', true));
      const snapshot = await getDocs(q);

      const nearbyBroadcasts = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...(doc.data() as { coordinates: GeoPoint; radiusMeters: number; teacherFullName: string; customId: string }),
        }))
        .filter(broadcast => {
          const teacherLocation = broadcast.coordinates;
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            teacherLocation.latitude,
            teacherLocation.longitude
          );
          return distance <= broadcast.radiusMeters;
        });

      setBroadcasts(nearbyBroadcasts);
    } catch (error) {
      showAlert('Error', 'Failed to fetch broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearbyBroadcasts();
  }, []);

  const joinBroadcast = async (broadcastId: string) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      showAlert('Error', 'User is not authenticated.');
      return;
    }

    setJoining(true);
    try {
      const studentDocRef = doc(firestore, 'students', user.uid);
      const studentDoc = await getDoc(studentDocRef);

      if (!studentDoc.exists()) {
        showAlert('Error', 'Student data not found.');
        setJoining(false);
        return;
      }

      const studentData = studentDoc.data();
      const location = await getCurrentLocation();

      const studentInfo = {
        ...studentData,
        timeSignedIn: Timestamp.now(),
        coordinates: new GeoPoint(location.latitude, location.longitude),
      };

      await setDoc(doc(firestore, `broadcasts/${broadcastId}/participants`, user.uid), studentInfo);
      showAlert('Success', 'You have successfully joined the broadcast!');
    } catch (error) {
      showAlert('Error', 'Failed to join broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setJoining(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', paddingTop: 23 }}>
        <View style={styles.loadingContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('StudentScreen')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFA500" />
          </TouchableOpacity>
          <ScanningAnimation />
          <Text style={styles.text}>Scanning for broadcasts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (joining) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', paddingTop: 23 }}>
        <JoiningAnimation />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000', paddingTop: 23 }}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.navigate('StudentScreen')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFA500" />
        </TouchableOpacity>
        <Text style={styles.availableBroadcastsText}>Available Broadcasts</Text>
        {broadcasts.length === 0 ? (
          <View style={styles.noBroadcastsContainer}>
            <Text style={styles.noBroadcastsText}>No broadcasts available</Text>
          </View>
        ) : (
          <FlatList
            data={broadcasts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => joinBroadcast(item.id)} style={styles.broadcastItem}>
                <Text style={styles.broadcastText}>
                  <Text style={styles.boldText}>Course:</Text> {item.customId}
                </Text>
                <Text style={styles.broadcastText}>
                  <Text style={styles.boldText}>Lecturer:</Text> {item.teacherFullName}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {alert && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <Text style={styles.alertMessage}>{alert.message}</Text>
          <TouchableOpacity onPress={closeAlert} style={styles.alertButton}>
            <Text style={styles.alertButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    fontSize: 16,
    color: '#FFA500',
    marginTop: 16,
  },
  broadcastItem: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  broadcastText: {
    fontSize: 16,
    color: '#FFA500',
    textAlign: 'left',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#FFA500',
  },
  courseText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFA500',
  },
  teacherText: {
    fontSize: 14,
    color: '#FFA500',
  },
  noBroadcastsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBroadcastsText: {
    fontSize: 18,
    color: '#FFA500',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
  },
  availableBroadcastsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 16,
    textAlign: 'center',
  },
  joiningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  alertBox: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    right: '10%',
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1000,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFA500',
    marginBottom: 10,
  },
  alertMessage: {
    fontSize: 14,
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  alertButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});

export default FindBroadcastScreen;