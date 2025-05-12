import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Image, StyleSheet, ScrollView, Modal, RefreshControl, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { auth, db } from '../../config/firebaseconfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const generateRandomId = () => {
  return 'TID-' + Math.random().toString(36).substr(2, 9).toUpperCase(); // Generate a random ID
};

const saveUserData = async (user: any, fullName: string, userRole: string, currentLevel: string, college: string, department: string, matricNumber?: string, teacherId?: string) => {
  try {
    console.log('Attempting to save user data:', { userRole, fullName, currentLevel, college, department });
    const collectionId = userRole === 'Student' ? 'students' : 'teachers'; // Use correct collection names
    const data: any = {
      fullName,
      email: user.email,
      role: userRole,
      createdAt: new Date(),
      currentLevel,
      college,
      department,
    };

    // Add fields conditionally to avoid undefined values
    if (userRole === 'Student' && matricNumber) {
      data.matricNumber = matricNumber;
    }
    if (userRole === 'Teacher' && teacherId) {
      data.teacherId = teacherId;
    }

    await setDoc(doc(db, collectionId, user.uid), data); // Save user data to Firestore
    console.log(`User data saved to ${collectionId} collection successfully.`);
  } catch (error) {
    console.error('Error saving user data:', error); // Log the error for debugging
    throw new Error('Failed to save user data to Firestore.');
  }
};

const SignUp = ({ navigation, onSignup }: any) => {
  const [fullName, setFullName] = useState(''); // Merged full name
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [errors, setErrors] = useState({
    fullName: false,
    email: false,
    password: false,
    currentLevel: false,
    college: false,
    department: false,
    matricNumber: false,
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [levelDropdownVisible, setLevelDropdownVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(''); // New state for user role
  const [teacherId, setTeacherId] = useState(''); // New state for teacher ID
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null); // State for custom alert

  const showAlert = (title: string, message: string) => {
    setAlert({ title, message }); // Set the alert state
  };

  const closeAlert = () => {
    setAlert(null); // Clear the alert state
  };

  const handleRoleSelection = (role: string) => {
    setUserRole(role);
    setErrors((prev) => ({ ...prev, userRole: false }));
    setErrorMessage('');
    if (role === 'Teacher') {
      setTeacherId(generateRandomId()); // Generate a random ID for teachers
    } else {
      setTeacherId(''); // Clear teacher ID if switching to student
    }
  };

  const handleSignup = async () => {
    const newErrors = {
      fullName: fullName.trim() === '',
      email: email.trim() === '',
      password: password.trim() === '',
      currentLevel: userRole === 'Student' && currentLevel.trim() === '', 
      college: userRole === 'Student' && college.trim() === '', // Validate college only for students
      department: userRole === 'Student' && department.trim() === '', // Validate department only for students
      matricNumber: userRole === 'Student' && matricNumber.trim() === '', // Validate matricNumber only for students
      userRole: userRole.trim() === '',
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await saveUserData(user, fullName, userRole, currentLevel, college, department, matricNumber, teacherId); // Save user data
      showAlert('Success', 'Signup successful! Redirecting to login...');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }], // Navigate to login page
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        showAlert('Error', 'The email address is already in use by another account.');
      } else {
        showAlert('Error', 'Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setFullName('');
    setEmail('');
    setPassword('');
    setCurrentLevel('');
    setCollege('');
    setDepartment('');
    setMatricNumber('');
    setTermsAccepted(false);
    setErrorMessage('');
    setErrors({
      fullName: false,
      email: false,
      password: false,
      currentLevel: false,
      college: false,
      department: false,
      matricNumber: false,
    }); 
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <>
      <StatusBar backgroundColor="black" barStyle="light-content" />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff0000" />
        </View>
      ) : (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={[styles.scrollViewContent, { paddingTop: 30, paddingBottom: 50 }]}>
            <View style={styles.container}>
              <Image source={require('../../assets/nobellsattendplus(2).png')} style={styles.logo} />

              <Text style={styles.title}>Sign Up</Text>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Full Name Field */}
              <TextInput
                style={[
                  styles.input,
                  errors.fullName ? styles.inputError : styles.inputDefault,
                ]}
                placeholder="Full Name"
                placeholderTextColor="#aaa"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  setErrors((prev) => ({ ...prev, fullName: false }));
                  setErrorMessage('');
                }}
                autoCorrect={true}
                autoCapitalize="words"
              />

              {/* Email Field */}
              <TextInput
                style={[
                  styles.input,
                  errors.email ? styles.inputError : styles.inputDefault,
                ]}
                placeholder="Email"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((prev) => ({ ...prev, email: false }));
                  setErrorMessage('');
                }}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {/* Password Field */}
              <TextInput
                style={[
                  styles.input,
                  errors.password ? styles.inputError : styles.inputDefault,
                ]}
                placeholder="Password"
                placeholderTextColor="#aaa"
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors((prev) => ({ ...prev, password: false }));
                  setErrorMessage('');
                }}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {/* User Role Selection */}
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    userRole === 'Student' ? styles.roleButtonSelected : styles.roleButtonDefault,
                  ]}
                  onPress={() => handleRoleSelection('Student')}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      userRole === 'Student' ? styles.roleButtonTextSelected : {},
                    ]}
                  >
                    Student
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    userRole === 'Teacher' ? styles.roleButtonSelected : styles.roleButtonDefault,
                  ]}
                  onPress={() => handleRoleSelection('Teacher')}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      userRole === 'Teacher' ? styles.roleButtonTextSelected : {},
                    ]}
                  >
                    Teacher
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Select Level Dropdown */}
              {userRole === 'Student' && ( // Show only for students
                <View
                  style={[
                    styles.dropdownContainer,
                    errors.currentLevel ? styles.inputError : styles.inputDefault,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setLevelDropdownVisible(!levelDropdownVisible)}
                    style={styles.dropdownButton}
                  >
                    <Text style={{ color: currentLevel ? 'black' : '#aaa' }}>
                      {currentLevel || 'Select Current Level'}
                    </Text>
                  </TouchableOpacity>

                  {levelDropdownVisible && (
                    <View style={styles.dropdownList}>
                      <ScrollView keyboardShouldPersistTaps="handled">
                        {['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'].map((level) => (
                          <TouchableOpacity
                            key={level}
                            onPress={() => {
                              setCurrentLevel(level);
                              setLevelDropdownVisible(false);
                              setErrors((prev) => ({ ...prev, currentLevel: false }));
                              setErrorMessage('');
                            }}
                            style={styles.dropdownItem}
                          >
                            <Text style={{ color: 'orange' }}>{level}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {/* Conditional Input Fields */}
              {userRole === 'Student' && (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      errors.matricNumber ? styles.inputError : styles.inputDefault,
                    ]}
                    placeholder="Matric Number"
                    placeholderTextColor="#aaa"
                    value={matricNumber}
                    onChangeText={(text) => {
                      const formatted = text.replace(/^(\d{4})\/?/, '$1/');
                      setMatricNumber(formatted);
                      setErrors((prev) => ({ ...prev, matricNumber: false }));
                      setErrorMessage('');
                    }}
                    keyboardType="numeric"
                  />

                  <TextInput
                    style={[
                      styles.input,
                      errors.college ? styles.inputError : styles.inputDefault,
                    ]}
                    placeholder="College"
                    placeholderTextColor="#aaa"
                    value={college}
                    onChangeText={(text) => {
                      setCollege(text.toUpperCase());
                      setErrors((prev) => ({ ...prev, college: false }));
                      setErrorMessage('');
                    }}
                  />

                  <TextInput
                    style={[
                      styles.input,
                      errors.department ? styles.inputError : styles.inputDefault,
                    ]}
                    placeholder="Department"
                    placeholderTextColor="#aaa"
                    value={department}
                    onChangeText={(text) => {
                      setDepartment(text);
                      setErrors((prev) => ({ ...prev, department: false }));
                      setErrorMessage('');
                    }}
                  />
                </>
              )}
              {userRole === 'Teacher' && (
                <View style={styles.teacherIdContainer}>
                  <Text style={styles.teacherIdValue}>{teacherId || 'Teacher ID will be generated'}</Text>
                </View>
              )}

              {/* Terms and Conditions Checkbox */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  style={{
                    width: 20,
                    height: 20,
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 4,
                    backgroundColor: termsAccepted ? '#4caf50' : 'white',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                  }}
                >
                  {termsAccepted && <Text style={{ color: 'white', fontWeight: 'bold' }}>✔</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTermsModalVisible(true)}>
                  <Text style={{ color: '#007bff', textDecorationLine: 'underline' }}>
                    I have read the Terms and Conditions
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Terms and Conditions Modal */}
              <Modal
                visible={termsModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setTermsModalVisible(false)}
              >
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                  <View
                    style={{
                      width: '90%',
                      backgroundColor: 'white',
                      borderRadius: 8,
                      padding: 20,
                      maxHeight: '80%',
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                      Terms and Conditions
                    </Text>
                    <ScrollView>
                      <Text style={{ fontSize: 14, color: '#333', marginBottom: 10 }}>
                        1. By signing up, you agree to provide accurate and truthful information.
                        2. Your data will be securely stored and used only for the purposes of this platform.
                        3. You agree to adhere to the platform's code of conduct and policies.
                        4. Any misuse of the platform may result in account suspension or termination.
                        5. The platform reserves the right to update these terms at any time.
                      </Text>
                    </ScrollView>
                    <TouchableOpacity
                      onPress={() => setTermsModalVisible(false)}
                      style={{
                        marginTop: 10,
                        padding: 10,
                        backgroundColor: '#4caf50',
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* Sign Up Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  { opacity: termsAccepted ? 1 : 0.5 },
                ]}
                onPress={handleSignup}
                disabled={!termsAccepted}
              >
                <Text style={styles.buttonText}>SignUp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.link}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.linkText}>Already have an account? Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
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
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'black', // Changed to black for the orange and black theme
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'black', // Changed to black for the orange and black theme
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black', // Changed to black for the orange and black theme
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: 'orange', // Changed to orange for the title
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    color: 'white', // Changed text color to white
    backgroundColor: '#333', // Changed background color to dark gray
  },
  inputDefault: {
    borderWidth: 2,
    borderColor: 'orange', // Changed border color to orange
  },
  inputError: {
    borderWidth: 2,
    borderColor: 'red',
  },
  matricNumberField: {
    borderWidth: 2,
    borderColor: 'orange', // Changed border color to orange
  },
  dropdownContainer: {
    borderWidth: 2,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#333', // Changed background color to dark gray
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: '100%',
  },
  dropdownButton: {
    height: '100%',
    justifyContent: 'center',
  },
  dropdownList: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: '#333', // Changed background color to dark gray
    borderWidth: 2,
    borderColor: 'orange', // Changed border color to orange
    borderRadius: 8,
    zIndex: 2,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#555', // Changed to a darker gray
  },
  button: {
    backgroundColor: 'orange', // Changed button background to orange
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'black', // Changed text color to black
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#ffe6e6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  link: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: 'orange', // Changed link text color to orange
    textDecorationLine: 'underline',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  roleButtonDefault: {
    backgroundColor: '#555', // Changed to a darker gray
  },
  roleButtonSelected: {
    backgroundColor: 'orange', // Changed selected button background to orange
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white', // Changed text color to white
  },
  roleButtonTextSelected: {
    color: 'black', // Changed selected button text color to black
  },
  teacherIdContainer: {
    marginBottom: 16,
    padding: 10,
    borderWidth: 2,
    borderColor: 'orange', // Orange border for visibility
    borderRadius: 8,
    backgroundColor: '#333', // Dark gray background
  },
  teacherIdLabel: {
    fontSize: 14,
    color: 'orange', // Orange text for label
    marginBottom: 4,
  },
  teacherIdValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white', // White text for the ID
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
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

export default SignUp;