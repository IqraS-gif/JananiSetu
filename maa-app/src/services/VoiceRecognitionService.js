/**
 * VoiceRecognitionService.js
 * Wrapper for expo-speech-recognition
 */

import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export const VoiceRecognitionService = {
    /**
     * Check and request permissions
     */
    async requestPermissions() {
        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        return granted;
    },

    /**
     * Start listening
     * @param {string} lang - Language code (e.g., 'hi-IN' or 'en-US')
     */
    async start(lang = 'hi-IN') {
        const isAvailable = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
        if (!isAvailable) {
            throw new Error("Speech recognition not available on this device");
        }

        await ExpoSpeechRecognitionModule.start({
            lang,
            interimResults: true,
            requiresOnDeviceRecognition: false,
            addsPunctuation: true,
        });
    },

    /**
     * Stop listening
     */
    async stop() {
        await ExpoSpeechRecognitionModule.stop();
    },

    /**
     * Cancel listening
     */
    async cancel() {
        await ExpoSpeechRecognitionModule.abort();
    }
};
