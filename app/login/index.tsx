import React, { useState, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Keyboard, TouchableWithoutFeedback, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseconfig';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseconfig';

const LoginScreen = ({ navigation, route }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: false, password: false });
  const [errorMessage, setErrorMessage] = useState('');

  useLayoutEffect(() => {
    if (route?.params?.hideTabs) {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    }
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, route]);

  const handleLogin = async () => {
    Keyboard.dismiss();

    const newErrors = {
      email: email.trim() === '',
      password: password.trim() === '',
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some((error) => error)) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const uid = user.uid; // Fetch the UID of the logged-in user

      // Search in the students collection
      const studentRef = doc(db, 'students', uid);
      const studentSnap = await getDoc(studentRef);

      if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        navigation.reset({
          index: 0,
          routes: [{ name: 'StudentScreen', params: { user: studentData } }],
        });
        return;
      }

      // If not found in students, search in the teachers collection
      const teacherRef = doc(db, 'teachers', uid);
      const teacherSnap = await getDoc(teacherRef);

      if (teacherSnap.exists()) {
        const teacherData = teacherSnap.data();
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherScreen', params: { user: teacherData } }],
        });
        return;
      }

      // If not found in either collection
      setErrorMessage('User data not found.');
    } catch (error: any) {
      setErrorMessage('Login failed. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback
      onPress={(event) => {
        if (event.target === event.currentTarget) {
          Keyboard.dismiss(); // Dismiss keyboard only when tapping outside input fields
        }
      }}
      accessible={false} // Prevent interference with input fields
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1 }}>
          {loading && ( // Ensure overlay only appears when loading
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="orange" />
            </View>
          )}
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.container}>
              <Image source={require('../../assets/nobellsattendplus(2).png')} style={styles.logo} />

              <Text style={styles.title}>Login</Text>

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
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
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
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

              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'black',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'orange',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: 'orange',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: 'white',
    backgroundColor: '#333',
  },
  inputError: {
    borderColor: 'red',
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
  loginButton: {
    backgroundColor: 'orange',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  loginButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    color: 'orange',
    textAlign: 'center',
    fontSize: 14,
  },
});

export default LoginScreen;