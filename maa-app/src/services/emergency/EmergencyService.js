import { Alert, Linking } from 'react-native';

export const EMERGENCY_NUMBERS = {
    ambulance: '108',
};

async function callNumber(number) {
    try {
        await Linking.openURL(`tel:${number}`);
    } catch (error) {
        console.error('[EmergencyService] Call failed:', error);
        Alert.alert('Call Failed', 'Unable to place the call from this device.');
    }
}

function callProfileContactOrWarn(number, label) {
    if (!number) {
        Alert.alert('Contact Missing', `${label} number is not set in profile.`);
        return;
    }
    void callNumber(number);
}

export function confirmAndCallAmbulance() {
    Alert.alert(
        'Emergency Call',
        `Call ambulance (${EMERGENCY_NUMBERS.ambulance}) now?`,
        [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Call',
                style: 'destructive',
                onPress: () => {
                    void callNumber(EMERGENCY_NUMBERS.ambulance);
                },
            },
        ]
    );
}

export function showEmergencyOptions(profile) {
    Alert.alert(
        'Emergency',
        'Choose who to call.',
        [
            {
                text: `Ambulance (${EMERGENCY_NUMBERS.ambulance})`,
                onPress: () => {
                    void callNumber(EMERGENCY_NUMBERS.ambulance);
                },
            },
            {
                text: 'ASHA Worker',
                onPress: () => callProfileContactOrWarn(profile?.asha_contact, 'ASHA worker'),
            },
            {
                text: 'Emergency Contact',
                onPress: () => callProfileContactOrWarn(profile?.emergency_contact, 'Emergency contact'),
            },
            { text: 'Cancel', style: 'cancel' },
        ]
    );
}
