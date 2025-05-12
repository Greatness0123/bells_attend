import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignUpScreen from './signup/index';
import LoginScreen from './login/index';
import TeacherDashboard from './teacher'; 
import StudentDashboard from './student'; 
import TeacherBroadcast from './teacher/BroadcastScreen';
import FindBroadcastScreen from './student/AvailableBroadcastScreen';
const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkFirstTime = async () => {
      const isFirstTime = await AsyncStorage.getItem('isFirstTime');
      setInitialRoute('Login'); 
    };

    checkFirstTime();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
        />
        <Stack.Screen 
          name="SignUp" 
          component={SignUpScreen} 
        />
        <Stack.Screen 
          name="TeacherScreen" 
          component={TeacherDashboard} 
        />
        <Stack.Screen 
          name="StudentScreen" 
          component={StudentDashboard} 
        />
         <Stack.Screen 
          name="TeacherBroadcastScreen" 
          component={TeacherBroadcast} 
        />
         <Stack.Screen 
          name="StudentBroadcastScreen" 
          component={FindBroadcastScreen} 
        />



      </Stack.Navigator>
    </NavigationContainer>
  );
}