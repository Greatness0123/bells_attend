// screens/TeacherBroadcastManager.tsx (Updated)
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, FlatList, TouchableOpacity, TextInput, Share, StyleSheet, RefreshControl, ScrollView, ActivityIndicator, SafeAreaView, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '../../config/firebaseconfig';
import { collection, getDocs, updateDoc, doc, addDoc, Timestamp, DocumentData, deleteDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { GeoPoint } from 'firebase/firestore';
import { getCurrentLocation } from '../../utils/locationHelpers';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import jsPDF from 'jspdf';

const TeacherBroadcast = ({ navigation, route }: any) => {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<{ id: string; [key: string]: any }[]>([]);
  const [radius, setRadius] = useState('5');
  const [customBroadcastId, setCustomBroadcastId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<DocumentData[]>([]);
  const [selectedBroadcast, setSelectedBroadcast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isRadiusEmpty, setIsRadiusEmpty] = useState(false);
  const [isBroadcastIdEmpty, setIsBroadcastIdEmpty] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null); // State for custom alert

  const sendNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  };

  const showAlert = (title: string, message: string) => {
    setAlert({ title, message }); // Set the alert state
  };

  const closeAlert = () => {
    setAlert(null); // Clear the alert state
  };

  const exportToPDF = async (broadcastId: string) => {
    setLoadingOverlay(true);
    try {
      const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const participants = participantsSnapshot.docs.map(doc => doc.data());

      const broadcastDoc = await getDoc(doc(firestore, 'broadcasts', broadcastId));
      const broadcast = broadcastDoc.exists() ? (broadcastDoc.data() as { createdAt?: any; customId?: string }) : {};
      const timestamp = broadcast.createdAt?.toDate().toLocaleString() || 'N/A';
      const customId = broadcast.customId || broadcastId;

      const pdfDoc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(10);

      pdfDoc.text('Attendance Record', 105, 10, { align: 'center' });
      pdfDoc.setFontSize(8);
      pdfDoc.text(`Course: ${customId}`, 105, 15, { align: 'center' });
      pdfDoc.text(`Timestamp: ${timestamp}`, 105, 20, { align: 'center' });

      let startY = 30;
      const headers = ['S/N', 'Full Name', 'Matric Number', 'College', 'Department', 'Current Level'];
      const columnWidths = [10, 50, 30, 30, 40, 30];

      headers.forEach((header, index) => {
        pdfDoc.text(header, 10 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), startY);
      });

      participants.forEach((p, rowIndex) => {
        const rowY = startY + 10 + rowIndex * 10;
        const rowData = [
          rowIndex + 1,
          p.fullName || 'N/A',
          p.matricNumber || 'N/A',
          p.college || 'N/A',
          p.department || 'N/A',
          p.currentLevel || 'N/A',
        ];
        rowData.forEach((cell, colIndex) => {
          pdfDoc.text(cell.toString(), 10 + columnWidths.slice(0, colIndex).reduce((a, b) => a + b, 0), rowY);
        });
      });

      if (Platform.OS === 'web') {
        pdfDoc.save(`${customId}.pdf`);
      } else {
        const pdfOutput = pdfDoc.output('blob');
        const fileUri = `${FileSystem.documentDirectory}${customId}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, await pdfOutput.text(), { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      showAlert('Error', 'Failed to export to PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const fetchTeacherBroadcasts = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        showAlert('Error', 'User is not authenticated.');
        return;
      }

      const q = collection(firestore, 'broadcasts');
      const snapshot = await getDocs(q);

      const teacherBroadcasts = snapshot.docs
        .filter(doc => doc.data().teacherId === user.uid && doc.data().isActive)
        .map(async doc => {
          const broadcastData = doc.data();
          const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${doc.id}/participants`));
          const participantCount = participantsSnapshot.size;
          return { id: doc.id, ...broadcastData, participantCount };
        });

      const broadcasts = await Promise.all(teacherBroadcasts);
      setBroadcasts(broadcasts);
    } catch (error) {
      showAlert('Error', 'Failed to fetch broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  useEffect(() => {
    fetchTeacherBroadcasts();

    const interval = setInterval(async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          console.error('User is not authenticated.');
          return;
        }

        const updatedBroadcasts = await Promise.all(
          broadcasts.map(async broadcast => {
            const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcast.id}/participants`));
            const participantCount = participantsSnapshot.size;
            return { ...broadcast, participantCount };
          })
        );

        setBroadcasts(updatedBroadcasts);
      } catch (error) {
        console.error('Error updating participant counts:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [broadcasts]);

  const startBroadcast = async () => {
    Keyboard.dismiss(); // Dismiss the keyboard when starting a broadcast
    const auth = getAuth();
    const user = auth.currentUser;
    const radiusMeters = parseFloat(radius);

    // Validate input fields
    const isRadiusInvalid = isNaN(radiusMeters) || radiusMeters <= 0;
    const isBroadcastIdInvalid = !customBroadcastId.trim();

    setIsRadiusEmpty(isRadiusInvalid);
    setIsBroadcastIdEmpty(isBroadcastIdInvalid);

    if (isRadiusInvalid || isBroadcastIdInvalid) {
      showAlert('Error', 'Please fill in all required fields correctly.');
      return; // Prevent starting the broadcast if any field is invalid
    }

    setLoadingOverlay(true); // Show loader
    try {
      if (!user) {
        showAlert('Error', 'User is not authenticated.');
        setLoadingOverlay(false); // Hide loader
        return;
      }

      const location = await getCurrentLocation(); // Get the user's current location

      // Fetch the teacher's full name
      const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
      const teacherFullName = teacherDoc.exists() ? teacherDoc.data()?.fullName || 'Unknown' : 'Unknown';

      // Add the broadcast to Firestore
      await addDoc(collection(firestore, 'broadcasts'), {
        teacherId: user.uid,
        teacherFullName,
        isActive: true,
        createdAt: Timestamp.now(),
        radiusMeters, // Store radius in meters
        coordinates: new GeoPoint(location.latitude, location.longitude),
        customId: customBroadcastId.trim().toUpperCase(), // Capitalize the custom broadcast ID
      });

      showAlert('Success', `Broadcast started! Broadcast ID: ${customBroadcastId.trim().toUpperCase()}`);
      sendNotification('Broadcast Started', `Broadcast "${customBroadcastId.trim().toUpperCase()}" has started.`);
      setCustomBroadcastId(''); // Clear the input field
      fetchTeacherBroadcasts(); // Refresh the list of broadcasts
    } catch (err) {
      showAlert('Error', (err as Error).message || 'Failed to start the broadcast.');
    } finally {
      setLoadingOverlay(false); // Hide loader
    }
  };

  const stopBroadcast = async (broadcastId: string) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(firestore, 'broadcasts', broadcastId), {
        isActive: false,
        endedAt: Timestamp.now(),
      });
      showAlert('Success', 'Broadcast stopped.');
      sendNotification('Broadcast Stopped', `Broadcast "${broadcastId}" has been stopped.`);
      fetchTeacherBroadcasts();
      setSelectedStudents([]);
      setSelectedBroadcast(null);
    } catch (err) {
      showAlert('Error', (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteBroadcast = async (broadcastId: string) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(firestore, 'broadcasts', broadcastId));
      setBroadcasts(prevBroadcasts => prevBroadcasts.filter(broadcast => broadcast.id !== broadcastId));
      showAlert('Success', 'Broadcast deleted.');
      sendNotification('Broadcast Deleted', `Broadcast "${broadcastId}" has been deleted.`);
    } catch (err) {
      showAlert('Error', (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const loadParticipants = async (broadcastId: string) => {
    try {
      if (selectedBroadcast === broadcastId) {
        setSelectedBroadcast(null);
        setSelectedStudents([]);
        return;
      }

      const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcastId}/participants`));
      const students = participantsSnapshot.docs.map(doc => doc.data());
      setSelectedStudents(students);
      setSelectedBroadcast(broadcastId);

      setBroadcasts(prevBroadcasts =>
        prevBroadcasts.map(broadcast =>
          broadcast.id === broadcastId
            ? { ...broadcast, participantCount: students.length }
            : broadcast
        )
      );
    } catch (error) {
      showAlert('Error', 'Failed to load participants: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleback = async () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherScreen' }],
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSelectedBroadcast(null);
    setSelectedStudents([]);
    await fetchTeacherBroadcasts();
    setRefreshing(false);
  };

  const sortedBroadcasts = broadcasts.sort((a, b) => {
    const dateA = a.createdAt?.toDate() || new Date(0);
    const dateB = b.createdAt?.toDate() || new Date(0);
    return dateB - dateA;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000', paddingTop: 23 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <TouchableOpacity onPress={handleback} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFA500" />
        </TouchableOpacity>

        <Text style={styles.title}>Broadcasts</Text>

        <Text style={styles.label}>Course:</Text>
        <TextInput
          value={customBroadcastId}
          onChangeText={text => {
            setCustomBroadcastId(text);
            setIsBroadcastIdEmpty(false);
          }}
          style={[styles.input, isBroadcastIdEmpty && styles.inputError]}
          placeholder="Enter course name"
        />
        <Text style={styles.label}>Set Broadcast Radius (meters):</Text>
        <TextInput
          value={radius}
          onChangeText={text => {
            setRadius(text);
            setIsRadiusEmpty(false);
          }}
          keyboardType="numeric"
          style={[styles.input, isRadiusEmpty && styles.inputError]}
          placeholder="5"
        />
        <Text style={styles.radiusNote}>
          The lowest radius to be used is a classroom, which is less than 3 meters. The highest is an LT, which is less than 25 meters.
        </Text>
        <TouchableOpacity onPress={startBroadcast} style={styles.startButton}>
          <Text style={styles.buttonText}>Start Broadcast</Text>
        </TouchableOpacity>

        <Text style={styles.label}>All Active Broadcasts:</Text>
        {broadcasts.length === 0 ? (
          <View style={styles.noBroadcastsContainer}>
            <Text style={styles.noBroadcastsText}>No active broadcasts...</Text>
          </View>
        ) : (
          <FlatList
            data={broadcasts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.broadcastItem,
                  selectedBroadcast === item.id && styles.selectedBroadcastItem,
                ]}
                onPress={() => loadParticipants(item.id)}
              >
                <Text style={styles.broadcastText}>
                  <Text style={styles.boldText}>Course:</Text> {item.customId || item.id}
                </Text>
                <Text style={styles.broadcastText}>
                  <Text style={styles.boldText}>Status:</Text> {item.isActive ? 'Active' : 'Ended'}
                </Text>
                <Text style={styles.broadcastText}>
                  <Text style={styles.boldText}>Created At:</Text> {item.createdAt?.toDate().toLocaleString() || 'N/A'}
                </Text>
                <Text style={styles.broadcastText}>
                  <Text style={styles.boldText}>Participants:</Text> {item.participantCount || 0}
                </Text>
                {item.isActive && (
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={() => stopBroadcast(item.id)}
                  >
                    <Text style={styles.buttonText}>Stop Broadcast</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteBroadcast(item.id)}
                >
                  <Text style={styles.buttonText}>Delete Broadcast</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 50 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {selectedBroadcast && (
          <View style={styles.participantsContainer}>
            <Text style={styles.participantsTitle}>Students in Broadcast</Text>
            <ScrollView style={styles.participantsList} keyboardShouldPersistTaps="handled">
              {selectedStudents.map((student, i) => (
                <Text key={i} style={styles.participantText}>
                  - {student.fullName} ({student.matricNumber}), {student.college}, {student.currentLevel}, {student.department}
                </Text>
              ))}
            </ScrollView>
            <View style={styles.exportButtonsContainer}>
              <TouchableOpacity style={styles.exportButtonPDF} onPress={() => exportToPDF(selectedBroadcast!)}>
                <Text style={styles.buttonText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {(loadingOverlay || actionLoading) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="orange" />
          </View>
        )}

        {alert && (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
            <TouchableOpacity onPress={closeAlert} style={styles.alertButton}>
              <Text style={styles.alertButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#000',
  },
  backButton: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#FFA500',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FFA500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#FFA500',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    backgroundColor: '#333',
    color: '#FFA500',
  },
  inputError: {
    borderColor: 'red',
    shadowColor: 'red',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
  startButton: {
    backgroundColor: '#FFA500',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  broadcastListContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  broadcastItem: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  broadcastText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#FFA500',
  },
  stopButton: {
    backgroundColor: '#FFA500',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF4500',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  participantsContainer: {
    marginTop: 24,
  },
  participantsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#FFA500',
  },
  participantText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#FFA500',
  },
  exportButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  exportButtonPDF: {
    backgroundColor: '#FFA500',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  selectedBroadcastItem: {
    borderWidth: 2,
    borderColor: '#FFA500',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#FFA500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  participantsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 50,
  },
  noBroadcastsContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  noBroadcastsText: {
    fontSize: 16,
    color: '#FFA500',
  },
  radiusNote: {
    fontSize: 12,
    color: '#FFA500',
    marginBottom: 16,
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

export default TeacherBroadcast;


