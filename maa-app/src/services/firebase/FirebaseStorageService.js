import { initializeApp } from '@firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from '@firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';

// Your web app's Firebase configuration
// IMPORTANT: Please fill in your actual apiKey and appId below.
const firebaseConfig = {

    apiKey: "AIzaSyARj8sSXGLwaAZpciAbZihVAMGf7jMLPbE",
    authDomain: "maaa-dc0a2.firebaseapp.com",
    projectId: "maaa-dc0a2",
    storageBucket: "maaa-dc0a2.firebasestorage.app",
    messagingSenderId: "855825754526",
    appId: "1:855825754526:web:a3fb9e0cb05532f7334e8f",
    measurementId: "G-GW0LR6FHWS"
};


const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export const uploadReportToFirebase = async (localUri, fileName) => {
    try {
        console.log(`Starting Firebase upload for ${fileName}...`);

        const isPdf = fileName.toLowerCase().endsWith('.pdf');
        const contentType = isPdf ? 'application/pdf' : 'image/jpeg';

        // Use Firebase Storage REST API to completely bypass the buggy SDK blobbing issue on Android
        const bucket = firebaseConfig.storageBucket;
        const uploadPath = `reports/${fileName}`;
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(uploadPath)}`;

        // Read local file as a blob
        const response = await fetch(localUri);
        const blob = await response.blob();

        const uploadRes = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
            },
            body: blob
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Firebase REST Error: ${uploadRes.status} ${errText}`);
        }

        const data = await uploadRes.json();
        const token = data.downloadTokens;

        if (!token) {
            throw new Error('Upload succeeded but no download token was returned.');
        }

        const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(uploadPath)}?alt=media&token=${token}`;
        console.log(`Upload complete! Remote URL:`, downloadURL);

        return downloadURL;
    } catch (error) {
        console.error('Firebase Storage Base64 Upload Error:', error);
        throw error;
    }
};
