import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Modal, ActivityIndicator, RefreshControl, ScrollView, PanResponder, SafeAreaView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, firestore } from '../../config/firebaseconfig';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import jsPDF from 'jspdf';

const TeacherDashboard = ({ navigation }: any) => {
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [teacherData, setTeacherData] = useState<any | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [loadingOverlay, setLoadingOverlay] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ x: 20, y: 630 }); // Initial position for the button
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ count: number; occurrences: { customId: string; date: string; time: string }[] }>({
    count: 0,
    occurrences: [],
  });
      
  const clearSearchResults = () => {
    setSearchResults({ count: 0, occurrences: [] });
    setSearchQuery('');
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // Allow dragging when the user holds down on the button
    },
    onPanResponderMove: (_, gestureState) => {
      setButtonPosition({
        x: Math.max(0, Math.min(gestureState.moveX, 300)), // Restrict horizontal movement
        y: Math.max(0, Math.min(gestureState.moveY, 700)), // Restrict vertical movement
      });
    },
    onPanResponderRelease: (_, gestureState) => {
      const screenWidth = 360; // Example screen width
      const screenHeight = 800; // Example screen height
      const newX = gestureState.moveX < screenWidth / 2 ? 20 : screenWidth - 76; // Stick to left or right
      const newY = Math.max(20, Math.min(gestureState.moveY, screenHeight - 76)); // Stick within vertical bounds

      // If the button is left in the middle, slide it back to the refresh position
      if (Math.abs(newX - 300) > 10 || Math.abs(newY - 620) > 10) {
        setButtonPosition({ x: 300, y: 620 });
      } else {
        setButtonPosition({ x: newX, y: newY });
      }
    },
  });

  useEffect(() => {
    const fetchTeacherData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const teacherDoc = await getDoc(doc(firestore, 'teachers', user.uid));
          if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            setTeacherData(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch teacher data:', error);
      }
    };

    const fetchTeacherBroadcasts = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          Alert.alert('Error', 'User is not authenticated.');
          return;
        }

        const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
        const teacherBroadcasts = await Promise.all(
          broadcastsSnapshot.docs
            .filter(doc => doc.data().teacherId === user.uid)
            .map(async doc => {
              const broadcastData = doc.data();
              const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${doc.id}/participants`));
              const participantCount = participantsSnapshot.size; // Count participants
              return { id: doc.id, ...broadcastData, participantCount };
            })
        );

        setBroadcasts(teacherBroadcasts);
      } catch (error) {
        Alert.alert('Error', 'Failed to fetch broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    const fetchData = async () => {
      await fetchTeacherData();
      await fetchTeacherBroadcasts();
    };
    fetchData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Reset button position when returning to this screen
      setButtonPosition({ x: 300, y: 620 });
    });

    return unsubscribe; // Cleanup the listener on unmount
  }, [navigation]);

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
        format: 'a4', // Use A4 size for better layout
      });

      pdfDoc.setFont('helvetica', 'normal');
      pdfDoc.setFontSize(10); // Set a smaller font size for better fit

      // Add header
      pdfDoc.text('Attendance Record', 105, 10, { align: 'center' });
      pdfDoc.setFontSize(8); // Smaller font size for sub-header
      pdfDoc.text(`Course: ${customId}`, 105, 15, { align: 'center' });
      pdfDoc.text(`Timestamp: ${timestamp}`, 105, 20, { align: 'center' });

      // Add table headers and data manually
      let startY = 30;
      const headers = ['S/N', 'Full Name', 'Matric Number', 'College', 'Department', 'Current Level'];
      const columnWidths = [10, 50, 30, 30, 40, 30]; // Adjust column widths for better layout

      // Draw headers
      headers.forEach((header, index) => {
        pdfDoc.text(header, 10 + columnWidths.slice(0, index).reduce((a, b) => a + b, 0), startY);
      });

      // Draw rows
      participants.forEach((p, rowIndex) => {
        const rowY = startY + 10 + rowIndex * 10; // Adjust row spacing
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

      // Save or share the PDF
      if (Platform.OS === 'web') {
        pdfDoc.save(`${customId}.pdf`); // Save the PDF directly in the browser
      } else {
        const pdfOutput = pdfDoc.output('blob'); // Generate a blob for the PDF
        const fileUri = `${FileSystem.documentDirectory}${customId}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, await pdfOutput.text(), { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri); // Share the PDF on mobile platforms
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export to PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false);
    }
  };

  const confirmDeleteBroadcast = (broadcastId: string) => {
    setSelectedBroadcastId(broadcastId);
    setDeleteModalVisible(true);
  };

  const deleteBroadcast = async () => {
    if (!selectedBroadcastId) return;
    try {
      // Delete the broadcast from the database
      await deleteDoc(doc(firestore, 'broadcasts', selectedBroadcastId));

      // Remove the broadcast from the local state
      setBroadcasts(prev => prev.filter(broadcast => broadcast.id !== selectedBroadcastId));

      Alert.alert('Broadcast deleted successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete broadcast: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDeleteModalVisible(false);
      setSelectedBroadcastId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'User is not authenticated.');
        return;
      }

      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const teacherBroadcasts = await Promise.all(
        broadcastsSnapshot.docs
          .filter(doc => doc.data().teacherId === user.uid)
          .map(async doc => {
            const broadcastData = doc.data();
            const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${doc.id}/participants`));
            const participantCount = participantsSnapshot.size; // Count participants
            return { id: doc.id, ...broadcastData, participantCount };
          })
      );

      setBroadcasts(teacherBroadcasts);

      // Reset button position on refresh
      setButtonPosition({ x: 300, y: 620 });
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh broadcasts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setRefreshing(false);
    }
  };

  const searchParticipants = async () => {
    setLoadingOverlay(true); // Show loader
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'User is not authenticated.');
        return;
      }

      const broadcastsSnapshot = await getDocs(collection(firestore, 'broadcasts'));
      const teacherBroadcasts = broadcastsSnapshot.docs.filter(doc => doc.data().teacherId === user.uid);

      let count = 0;
      const occurrences: { customId: string; date: string; time: string }[] = [];

      for (const broadcast of teacherBroadcasts) {
        const participantsSnapshot = await getDocs(collection(firestore, `broadcasts/${broadcast.id}/participants`));
        participantsSnapshot.forEach(participantDoc => {
          const participantData = participantDoc.data();
          if (
            participantData.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            participantData.matricNumber?.toString().toLowerCase().includes(searchQuery.toLowerCase())
          ) {
            count++;
            const dateTime = participantData.timeSignedIn?.toDate().toLocaleString() || 'N/A';
            const [date, time] = dateTime.split(', ');
            occurrences.push({ customId: broadcast.data().customId || broadcast.id, date, time });
          }
        });
      }

      setSearchResults({ count, occurrences });
    } catch (error) {
      Alert.alert('Error', 'Failed to search participants: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoadingOverlay(false); // Hide loader
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
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Teacher Dashboard</Text>
            <View style={styles.topIconsContainer}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutIcon}>
                <Ionicons name="log-out-outline" size={24} color="red" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.profileIcon}>
                <Ionicons name="person-circle-outline" size={24} color="orange" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.welcomeText}>Welcome, {teacherData?.fullName || 'Teacher'}</Text>
          <Text style={styles.pastAttendanceTitle}>Past Attendance Records</Text>
          {broadcasts.length === 0 ? (
            <View style={styles.noBroadcastsContainer}>
              <Text style={styles.noBroadcastsText}>No past attendance records</Text>
            </View>
          ) : (
            <FlatList
              data={broadcasts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const dateTime = item.createdAt?.toDate().toLocaleString() || 'N/A';
                const [date, time] = dateTime.split(', ');
                return (
                  <View style={styles.broadcastItem}>
                    <Text style={styles.broadcastHeader}>
                      <Text style={styles.dateText}>{date}</Text>, <Text style={styles.timeText}>{time}</Text>
                    </Text>
                    <Text style={styles.courseText}>{item.customId || 'N/A'}</Text>
                    <Text style={styles.broadcastText}>
                      <Text style={styles.boldText}>Status:</Text> {item.isActive ? 'Active' : 'Ended'}
                    </Text>
                    <Text style={styles.broadcastText}>
                      <Text style={styles.boldText}>Participants:</Text> {item.participantCount || 0}
                    </Text>
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity style={styles.downloadButton} onPress={() => exportToPDF(item.id)}>
                        <Ionicons name="download-outline" size={16} color="black" />
                        <Text style={styles.downloadButtonText}>PDF</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconButton} onPress={() => confirmDeleteBroadcast(item.id)}>
                        <Ionicons name="trash-outline" size={24} color="red" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Profile</Text>
                <Text style={styles.modalText}>Name: {teacherData?.fullName || 'N/A'}</Text>
                <Text style={styles.modalText}>Teacher ID: {teacherData?.teacherId || 'N/A'}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal
            animationType="fade"
            transparent={true}
            visible={deleteModalVisible}
            onRequestClose={() => setDeleteModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Confirm Delete</Text>
                <Text style={styles.modalText}>Are you sure you want to delete this broadcast?</Text>
                <View style={styles.modalButtonsContainer}>
                  <TouchableOpacity onPress={deleteBroadcast} style={styles.confirmButton}>
                    <Text style={styles.confirmButtonText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDeleteModalVisible(false)} style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.searchButton]}
          onPress={() => setSearchModalVisible(true)}
        >
          <Ionicons name="search-outline" size={24} color="white" />
        </TouchableOpacity>

        {/* Location Button */}
        <View
          style={[styles.locationButton]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity onPress={() => navigation.navigate('TeacherBroadcastScreen')}>
            <Ionicons name="location-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={searchModalVisible}
          onRequestClose={() => {
            setSearchModalVisible(false);
            clearSearchResults(); // Clear search results when modal is closed
          }}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Search Participants</Text>
              <TextInput
                style={styles.input}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Enter name or matric number"
                placeholderTextColor="#aaa"
              />
              {loadingOverlay ? ( // Show loader while searching
                <ActivityIndicator size="large" color="orange" style={{ marginTop: 16 }} />
              ) : (
                <>
                  {searchResults.count > 0 && (
                    <View style={styles.searchResults}>
                      <Text style={styles.resultsText}>Occurrences Found: {searchResults.count}</Text>
                      {searchResults.occurrences.map((occurrence, index) => (
                        <Text key={index} style={styles.resultItem}>
                          <Text style={styles.boldText}>Custom ID:</Text> {occurrence.customId} {'\n'}
                          <Text style={styles.boldText}>Date:</Text> {occurrence.date} {'\n'}
                          <Text style={styles.boldText}>Time:</Text> {occurrence.time}
                        </Text>
                      ))}
                    </View>
                  )}
                  {searchResults.count === 0 && searchQuery && (
                    <Text style={styles.noResultsText}>No occurrences found.</Text>
                  )}
                </>
              )}
              <TouchableOpacity onPress={searchParticipants} style={styles.searchButtonModal}>
                <Text style={styles.searchButtonText}>Search</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSearchModalVisible(false);
                  clearSearchResults(); // Clear search results when modal is closed
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {loadingOverlay && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="orange" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
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
  welcomeText: {
    fontSize: 18,
    color: 'white',
    marginLeft: 16,
    marginTop: 10,
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
  courseText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'orange',
    marginBottom: 8,
  },
  broadcastText: {
    fontSize: 14,
    color: 'white',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: 'white',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'orange',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    flex: 1,
    justifyContent: 'center',
  },
  downloadButtonText: {
    color: 'black',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  iconButton: {
    padding: 8,
    alignItems: 'center',
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
    textAlign: 'left', // Align text to the left
    alignSelf: 'stretch', // Ensure it spans the modal width
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmButton: {
    backgroundColor: 'orange',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginRight: 8,
  },
  confirmButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: 'red',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: 'orange',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  closeButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
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
  locationButton: {
    position: 'absolute',
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
    right: 20, // Fixed to the right side
    bottom: 100, // Adjusted bottom position
  },
  searchButton: {
    position: 'absolute',
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
    zIndex: 101,
    right: 20, // Fixed to the right side
    bottom: 180, // Adjusted bottom position
  },
  searchButtonModal: {
    backgroundColor: 'orange',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  searchResults: {
    marginTop: 16,
    alignSelf: 'stretch',
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
  },
  resultsText: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
  },
  resultItem: {
    fontSize: 14,
    color: 'orange',
    marginBottom: 12,
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: 'red',
    marginTop: 16,
  },
  input: {
    backgroundColor: '#555',
    color: 'white',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 16,
  },
});

export default TeacherDashboard;