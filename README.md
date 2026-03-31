# JananiSetu (जननी सेतु) 🤱

[![JananiSetu Demo Video](https://img.youtube.com/vi/i2Sp_TmBdzc/0.jpg)](https://www.youtube.com/watch?v=i2Sp_TmBdzc)

**JananiSetu** is a comprehensive, AI-integrated digital health platform designed to reduce maternal mortality and improve pregnancy outcomes by bridging the knowledge gap in rural and semi-urban India.

---

## 🛑 The Problem
Maternal health in rural India faces significant challenges:
- **High Maternal Mortality Ratio (MMR)**: Often due to delayed detection of risks like gestational diabetes or hypertension.
- **Monitoring Gaps**: Expectant mothers often lack access to continuous nutritional guidance and clinical tracking.
- **Coordination Hurdles**: Communication between mothers, ASHA workers, and doctors is often fragmented and paper-based.
- **Low Health Literacy**: Complex medical information is often inaccessible to users with limited formal education.

---

## 🚀 How We Solve the Problem

We have designed a 3-view system tailored for:
- **👩‍🍼 Pregnant Woman**
- **👩‍⚕️ ASHA Worker**
- **👨‍⚕️ Doctor**

Each interface is built specifically for their real-world needs and constraints, ensuring seamless coordination and early risk detection.

### 👩‍🍼 Pregnant Woman (User View)

- **Smart Nutrition Logger**
  - Provides detailed breakdown of food intake (calcium, protein, folic acid, vitamins, sodium)
  - *(Tech: Dataset + Database + API fallback → ensures accurate nutrition data even offline)*
  - Input via image selection / voice / food image scan

- **SOS Emergency Button**
  - Sends SMS + live location (Google Maps) to driver/contact instantly
  - *(Tech: GPS + SMS API → enables real-time emergency alerts and tracking)*

- **Janani Voice Companion**
  - Guides users on government schemes, insurance, benefits
  - *(Tech: LLM + RAG → delivers personalized and context-aware guidance)*

- **Health Risk Prediction**
  - **BP trends** *(Tech: LSTM → analyzes time-series data to detect early abnormalities)*
  - **Diabetes risk** *(Tech: XGBoost → predicts risk using structured medical parameters)*

- **AI Vision Scanner**
  - Detects visible symptoms (e.g., swelling)
  - *(Tech: CLAHE → enhances low-quality images + SSDL → detects symptoms in real-time)*

- **Daily Health Tools**
  - Water intake logger, Baby kick counter, Doctor visit history, Daily reminders
  - *(Tech: Rule-based tracking → ensures consistent daily monitoring)*

- **Report Management**
  - Upload + extract medical reports into structured format
  - *(Tech: OCR + parsing → converts reports into usable data)*

- **Vision Tests (Clinical-based)**
  - Contrast sensitivity, Amsler grid test, Cognitive/visual tests
  - *(Tech: Based on validated clinical research methods)*

### 👩‍⚕️ ASHA Worker (Field View)

- **Smart Routing & Prioritization**
  - Patients ranked based on risk level (Low / High / Critical)
  - *(Tech: Risk scoring engine → prioritizes high-risk cases efficiently)*

- **Complete Patient History**
  - Access to all records, reports, and past visits
  - *(Tech: Centralized database → ensures continuous patient tracking)*

- **Medicine & Report Updates**
  - Add/update prescriptions and view reports in real-time
  - *(Tech: Structured data system → reduces errors and duplication)*

- **Voice Notes → Structured Reports**
  - Converts voice inputs into doctor-readable reports
  - *(Tech: Speech-to-text → eliminates manual entry effort)*

- **Risk Monitoring Dashboard**
  - View and track high-risk pregnancies efficiently
  - *(Tech: ML + rule engine → provides actionable insights)*

### 👨‍⚕️ Doctor (Expert View)

- **Structured Patient Summaries**
  - Clean, pre-processed data for faster decision-making
  - *(Tech: Data aggregation → reduces analysis time)*

- **High-Risk Case Alerts**
  - Immediate visibility into critical patients
  - *(Tech: Alert system → ensures timely intervention)*

- **Continuous Monitoring Access**
  - Track patient history, trends, and ASHA notes
  - *(Tech: Integrated system → enables end-to-end tracking)*

- **Feedback Loop**
  - Add notes/instructions visible to ASHA workers
  - *(Tech: Connected workflow → improves coordination)*

---

## 🌍 Scalability & Real-World Feasibility
- **Offline-first architecture**: Works without internet (Sync engine → auto-syncs when online)
- **Voice-first interaction**: No typing required (Speech-to-text → easy input)
- **Simple & intuitive UI**: Designed for low literacy users
- **Multilingual support**: Accessible in local languages (English & Hindi)

---

## 🛠️ Technology Stack
- **Frontend**: React Native, Expo, SQLite (Offline-first architecture)
- **Backend/ML**: Python (Flask/FastAPI), Scikit-learn, XGBoost, LSTM
- **AI**: Gemini AI (LLM) for conversational assistance and RAG-based guidance
- **Vision**: OCR (Tesseract/EasyOCR), Image enhancement (CLAHE)
- **Communication**: SMS Gateway Integration, Google Maps API

---

## 💎 Impact & Benefits
1. **Early Intervention**: Automated risk detection reduces delays in critical care.
2. **Empowerment**: Provides mothers with direct access to their own health data and nutritional knowledge.
3. **Efficiency**: Streamlines the workload for ASHA workers through intelligent routing and digital documentation.
4. **Data-Driven Decisions**: Enables doctors to make better clinical decisions with structured, long-term patient histories.

---

## 📁 Project Structure
```bash
JananiSetu/
├── maa-app/           # React Native Mobile Application (Expo)
│   ├── database/      # SQLite schema and seed data
│   ├── src/           # Component, Screen, and Service logic
│   └── App.js         # Navigation and entry point
├── risk-radar/        # ML & Prediction Services
│   ├── ml-service/    # Python Flask/FastAPI service
│   └── models/        # Trained XGBoost/LSTM models
└── README.md          # Root documentation
```

---

## 🚀 Installation & Usage

1. **Clone the repository**
   ```bash
   git clone https://github.com/IqraS-gif/JananiSetu.git
   cd JananiSetu
   ```

2. **Run the Mobile App**
   ```bash
   cd maa-app
   npm install
   npx expo start
   ```

3. **Run the ML Service**
   ```bash
   cd ../risk-radar/ml-service
   pip install -r requirements.txt
   python app.py
   ```

---

## 📄 License
This project is licensed under the MIT License.
