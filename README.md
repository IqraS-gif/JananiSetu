# JananiSetu (जननी सेतु) 🤱

**JananiSetu** is a comprehensive, AI-integrated digital health platform designed to empower expectant mothers and healthcare workers in India. This repository contains the full source code for the mobile application and the supporting machine learning services.

---

## 🏗️ Project Components

The project is divided into two primary services:

### 1. [Maa App (Mobile Application)](./maa-app/)
A production-grade, offline-first mobile application built with **React Native (Expo)**.
- **Nutrition Tracking**: Voice-activated logging for 7,000+ Indian food items.
- **Clinical Scheduling**: Automated ANC visit tracking based on LMP.
- **Eye Health**: Interactive vision tests (Acuity, Contrast, Amsler) with AI risk assessment.
- **Bilingual**: Full support for English and Hindi.

### 2. [Risk-Radar (ML Service)](./risk-radar/)
A Python-based machine learning backend that powers the predictive health features.
- **Diabetes Prediction**: Random Forest models for gestional diabetes risk assessment.
- **API service**: Serves predictions to the mobile app for real-time clinical support.

---

## 🌟 Mission
Our mission is to reduce maternal mortality and improve pregnancy outcomes by bridging the knowledge gap in rural and semi-urban India through localized, accessible, and AI-driven technology.

---

## 🚀 Quick Start (Local Development)

```bash
# Clone the repository
git clone https://github.com/IqraS-gif/JananiSetu.git
cd JananiSetu

# To run the Mobile App
cd maa-app
npm install
npx expo start

# To run the ML Service
cd ../risk-radar/ml-service
pip install -r requirements.txt
python app.py
```

---

## 🛠️ Tech Stack
- **Frontend**: React Native, Expo, SQLite (Offline-first).
- **Backend/ML**: Python, Flask, Scikit-learn, Pandas.
- **AI**: Gemini AI Integration for personalized consultation.
- **Voice**: Expo Speech Recognition for hands-free logging.

---

## 📈 Project Milestones & Status
- [x] Core MVP Development (March 2026)
- [x] AI Integration (Gemini/Groq)
- [x] Initial ML Service Deployment
- [ ] Beta Testing (April 2026)
- [ ] Clinical Trials Support

---

## 📞 Contact & Support
For any queries related to JananiSetu, please reach out to the project administrator.

---

## 📄 License
This project is licensed under the MIT License.
