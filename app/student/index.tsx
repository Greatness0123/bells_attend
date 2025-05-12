// app/student/DashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, RefreshControl, ScrollView, FlatList, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { auth, firestore } from '../../config/firebaseconfig';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

const StudentDashboard = ({ navigation, route }: any) => {
  const router = useRouter();
  const [userData, setUserData] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [updatedData, setUpdatedData] = useState<any>({});
  const [refreshing, setRefreshing] = useState(false);
  const [pastBroadcasts, setPastBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(firestore, 'students', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setUpdatedData(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchPastBroadcasts = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
          const broadcasts = [];

          for (const broadcastDoc of broadcastsSnapshot.docs) {
            const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastDoc.id}/participants`));
            const participantDoc = participantsSnapshot.docs.find(doc => doc.id === user.uid);

            if (participantDoc) {
              const broadcastData = broadcastDoc.data();
              const participantData = participantDoc.data();
              broadcasts.push({
                id: broadcastDoc.id,
                customId: broadcastData.customId || broadcastDoc.id,
                teacherFullName: broadcastData.teacherFullName || 'Unknown',
                joinedAt: participantData.timeSignedIn?.toDate() || 'N/A',
              });
            }
          }

          setPastBroadcasts(broadcasts);
        }
      } catch (error) {
        console.error('Failed to fetch past broadcasts:', error);
      }
    };

    fetchPastBroadcasts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(firestore, 'students', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setUpdatedData(data);
        }

        const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
        const broadcasts = [];

        for (const broadcastDoc of broadcastsSnapshot.docs) {
          const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastDoc.id}/participants`));
          const participantDoc = participantsSnapshot.docs.find(doc => doc.id === user.uid);

          if (participantDoc) {
            const broadcastData = broadcastDoc.data();
            const participantData = participantDoc.data();
            broadcasts.push({
              id: broadcastDoc.id,
              customId: broadcastData.customId || broadcastDoc.id,
              teacherFullName: broadcastData.teacherFullName || 'Unknown',
              joinedAt: participantData.timeSignedIn?.toDate() || 'N/A',
            });
          }
        }

        setPastBroadcasts(broadcasts);
      }
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handlebroadcastscreen = async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'StudentBroadcastScreen' }],
      });
    } catch (error) {
      console.error('Routing failed:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(firestore, 'students', user.uid), updatedData);
        setUserData(updatedData);
        setEditing(false);
        Alert.alert(
          'Success',
          'Your information has been updated. Note: Updates will be applied in 3 days.'
        );
      }
    } catch (error) {
      console.error('Failed to update user data:', error);
      Alert.alert('Error', 'Failed to update your information.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="orange" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black', paddingTop: 23 }}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Student Dashboard</Text>
            <View style={styles.topIconsContainer}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
                <Ionicons name="log-out-outline" size={24} color="red" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.profileIcon}>
                <Ionicons name="person-circle-outline" size={24} color="orange" />
              </TouchableOpacity>
            </View>
          </View>
          {userData?.fullName && <Text style={styles.welcomeText}>Welcome, <Text style={styles.nameText}>{userData.fullName}</Text></Text>}

          <Text style={styles.pastAttendanceTitle}>Past Attendance</Text>
          {pastBroadcasts.length === 0 ? (
            <View style={styles.noBroadcastsContainer}>
              <Text style={styles.noBroadcastsText}>No past attendance</Text>
            </View>
          ) : (
            <FlatList
              data={pastBroadcasts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const dateTime = item.joinedAt?.toLocaleString() || 'N/A';
                const [date, time] = dateTime.split(', ');
                return (
                  <View style={styles.broadcastItem}>
                    <Text style={styles.broadcastHeader}>
                      <Text style={styles.dateText}>{date}</Text>, <Text style={styles.timeText}>{time}</Text>
                    </Text>
                    <Text style={styles.broadcastText}>
                      <Text style={styles.boldText}>Course:</Text> {item.customId}
                    </Text>
                    <Text style={styles.broadcastText}>
                      <Text style={styles.boldText}>Lecturer:</Text> {item.teacherFullName}
                    </Text>
                    <Text style={styles.broadcastText}>
                      <Text style={styles.boldText}>Status:</Text> Successful
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </ScrollView>

        <TouchableOpacity onPress={handlebroadcastscreen} style={styles.fixedRoundButton}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>

        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Profile</Text>
              {editing ? (
                <>
                  <TouchableOpacity onPress={() => setEditing(false)} style={styles.backArrow}>
                    <Ionicons name="arrow-back" size={24} color="orange" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    value={updatedData.fullName}
                    onChangeText={(text) => setUpdatedData({ ...updatedData, fullName: text })}
                    placeholder="Full Name"
                  />
                  <TextInput
                    style={styles.input}
                    value={updatedData.matricNumber}
                    onChangeText={(text) => setUpdatedData({ ...updatedData, matricNumber: text })}
                    placeholder="Matric Number"
                  />
                  <TextInput
                    style={styles.input}
                    value={updatedData.department}
                    onChangeText={(text) => setUpdatedData({ ...updatedData, department: text })}
                    placeholder="Department"
                  />
                  <TextInput
                    style={styles.input}
                    value={updatedData.college}
                    onChangeText={(text) => setUpdatedData({ ...updatedData, college: text })}
                    placeholder="College"
                  />
                  <TextInput
                    style={styles.input}
                    value={updatedData.currentLevel}
                    onChangeText={(text) => setUpdatedData({ ...updatedData, currentLevel: text })}
                    placeholder="Current Level"
                  />
                  <Text style={styles.noteText}>Note: Updates will be applied in 3 days.</Text>
                  <TouchableOpacity onPress={handleUpdate} style={styles.saveButton}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalText}>Name: {userData?.fullName}</Text>
                  <Text style={styles.modalText}>Matric Number: {userData?.matricNumber}</Text>
                  <Text style={styles.modalText}>Department: {userData?.department}</Text>
                  <Text style={styles.modalText}>College: {userData?.college}</Text>
                  <Text style={styles.modalText}>Current Level: {userData?.currentLevel}</Text>
                  <View style={styles.iconContainer}>
                    <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconButton}>
                      <Ionicons name="create-outline" size={24} color="orange" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.iconButton}>
                      <Ionicons name="close-circle-outline" size={24} color="red" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'orange',
    textAlign: 'left',
  },
  topIconsContainer: {
    flexDirection: 'row',
  },
  logoutIcon: {
    marginRight: 16,
  },
  profileIcon: {
    marginRight: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  pastAttendanceTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'left',
    marginLeft: 16,
  },
  noBroadcastsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  noBroadcastsText: {
    fontSize: 16,
    color: 'white',
  },
  broadcastItem: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 8,
    marginVertical: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  broadcastHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dateText: {
    color: 'white',
  },
  timeText: {
    color: 'orange',
  },
  broadcastText: {
    fontSize: 14,
    color: 'white',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: 'orange',
  },
  fixedRoundButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'orange',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 100,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'orange',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 16,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderColor: 'orange',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    backgroundColor: '#444',
    color: 'white',
    width: '100%',
  },
  noteText: {
    fontSize: 14,
    color: 'orange',
    textAlign: 'left',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: 'orange',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  editButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: 'orange',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
  },
  saveButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: 'red',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  backArrow: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    width: '50%',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    fontWeight: 'bold',
    color: 'orange',
  },
  welcomeText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default StudentDashboard;