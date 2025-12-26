import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import SmsListener from 'react-native-android-sms-listener';
import { BACKEND_URL } from '../../constants/constants';


// const BACKEND_URL ='http://192.168.1.16:5001'; 

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function SMSSyncScreen() {
  const [selectedService, setSelectedService] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [syncCount, setSyncCount] = useState(0);
  
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const smsListenerRef = useRef(null);

  useEffect(() => {
    requestNotificationPermission();
    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (isListening && timeRemaining > 0) {
      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            stopListening();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isListening, timeRemaining]);

  const requestNotificationPermission = async () => {
    if (Platform.OS === 'android') {
      await Notifications.requestPermissionsAsync();
    }
  };

  const sendNotification = async (sender, service) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📨 SMS Synced!',
        body: `Message from ${sender} (${service.toUpperCase()}) saved successfully`,
        sound: true,
      },
      trigger: null, // Show immediately
    });
  };

  const requestSMSPermission = async () => {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      return (
        granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  };

  const startListening = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Error', 'This app only works on Android');
      return;
    }

    const hasPermission = await requestSMSPermission();
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'SMS permission is required to sync messages');
      return;
    }

    const durationInSeconds = parseInt(timerMinutes) * 60;
    setTimeRemaining(durationInSeconds);
    setIsListening(true);
    setSyncCount(0);

    smsListenerRef.current = SmsListener.addListener(message => {
      handleIncomingSMS(message);
    });

    timerRef.current = setTimeout(() => {
      stopListening();
      Alert.alert('Sync Complete', `SMS listening stopped. ${syncCount} messages synced.`);
    }, durationInSeconds * 1000);

    Alert.alert('Started', `Listening for ${timerMinutes} minute(s)`);
  };

  const handleIncomingSMS = async (message) => {
    const sender = message.originatingAddress || '';
    const body = message.body || '';

    console.log('SMS Received:', { sender, body });

    // "Others" option - save ALL messages without filtering
    if (selectedService === 'others') {
      await syncToBackend(sender, body, 'others');
      return;
    }

    // Filter: Check if SMS contains the selected service keyword
    const keyword = selectedService.toLowerCase();
    const senderLower = sender.toLowerCase();
    const bodyLower = body.toLowerCase();

    if (senderLower.includes(keyword) || bodyLower.includes(keyword)) {
      await syncToBackend(sender, body, selectedService);
    }
  };

  const syncToBackend = async (sender, body, service) => {
    try {
      console.log("BACKEND_URL:::::",`${BACKEND_URL}/sync-message`)
      await axios.post(`${BACKEND_URL}/sync-message`, {
        sender,
        body,
        service: service,
        timestamp: Date.now()
      });
      
      console.log('SMS synced:', sender);
      setSyncCount(prev => prev + 1);
      
      // Send notification
      await sendNotification(sender, service);
      
    } catch (error) {
      console.error('Failed to sync SMS:', error.message);
    }
  };

  const stopListening = () => {
    if (smsListenerRef.current) {
      smsListenerRef.current.remove();
      smsListenerRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIsListening(false);
    setTimeRemaining(0);
  };

  const isSyncDisabled = !selectedService || !timerMinutes || isListening;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SMS Sync App</Text>
      <Text style={styles.subtitle}>Sync bank SMS to backend</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Select Service</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedService}
            onValueChange={setSelectedService}
            enabled={!isListening}
            style={styles.picker}
          >
            <Picker.Item label="-- Select Service --" value="" />
            <Picker.Item label="HDFC Bank" value="hdfc" />
            <Picker.Item label="Paytm" value="paytm" />
            <Picker.Item label="SBI Bank" value="sbi" />
            <Picker.Item label="Others (All Messages)" value="others" />
          </Picker>
        </View>

        <Text style={styles.label}>Timer Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          value={timerMinutes}
          onChangeText={setTimerMinutes}
          keyboardType="numeric"
          placeholder="e.g., 1, 5, 10"
          placeholderTextColor="#999"
          editable={!isListening}
        />

        {isListening && (
          <View style={styles.statusContainer}>
            <View style={styles.listeningIndicator} />
            <Text style={styles.statusText}>
              Listening... {Math.floor(timeRemaining / 60)}m {timeRemaining % 60}s
            </Text>
          </View>
        )}

        {isListening && syncCount > 0 && (
          <Text style={styles.syncCountText}>
            ✅ {syncCount} message{syncCount !== 1 ? 's' : ''} synced
          </Text>
        )}

        <Pressable
          style={[styles.button, isSyncDisabled && styles.buttonDisabled]}
          onPress={startListening}
          disabled={isSyncDisabled}
        >
          <Text style={styles.buttonText}>
            {isListening ? 'Listening...' : 'Start Sync'}
          </Text>
        </Pressable>

        {isListening && (
          <Pressable
            style={[styles.button, styles.buttonStop]}
            onPress={() => {
              stopListening();
              Alert.alert('Stopped', `SMS listening stopped. ${syncCount} messages synced.`);
            }}
          >
            <Text style={styles.buttonText}>Stop Listening</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 30,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  listeningIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc3545',
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#856404',
    fontWeight: '600',
  },
  syncCountText: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonStop: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
