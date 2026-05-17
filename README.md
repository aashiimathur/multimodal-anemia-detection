# AI-Based Multi-Modal Anemia Detection System

A full-stack AI healthcare application for non-invasive anemia risk screening using:

- Voice Biomarker Analysis
- Nail Pallor Detection
- Symptom Assessment
- Previous Hemoglobin Analysis

The system combines Machine Learning, Signal Processing, Computer Vision, and Multimodal Fusion to generate explainable anemia risk predictions.

---

# Features

## Voice-Based Analysis
- Hemoglobin estimation
- Anemia severity prediction
- Acoustic biomarker extraction
- Jitter, Shimmer, HNR, HBAI analysis

## Nail Pallor Detection
- Nail image upload
- Computer vision-based pallor analysis
- RGB + HSV feature extraction
- Nail anemia risk estimation

## Symptom Assessment
- Fatigue
- Dizziness
- Pale Skin
- Headache
- Shortness of Breath

## Previous Hb History
- Previous hemoglobin input
- Trend analysis
- Risk adjustment

## Multimodal Fusion
Combines all modalities into a final anemia risk score.

---

# Tech Stack

## Frontend
- React.js
- CSS3
- Axios

## Backend
- FastAPI
- Python

## AI / ML
- Scikit-learn
- Librosa
- Parselmouth
- OpenCV

---

# Machine Learning Models

| Model | Purpose |
|---|---|
| ExtraTreesClassifier | Anemia classification |
| ExtraTreesRegressor | Hemoglobin estimation |
| Nail ExtraTreesClassifier | Nail pallor risk |

---

# Datasets Used

- VOICED Dataset (Voice samples)
- Nail Anemia Dataset (Nail images + Hb values)

---

# Installation

## Clone Repository

```bash
git clone <your-repo-link>
cd anemia-detection-addedNail

# Backend Setup

```bash
cd anemia-backend
```

## Create Virtual Environment

```bash
python -m venv .venv
```

## Activate Virtual Environment (Windows)

```bash
.venv\Scripts\activate
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Run Backend Server

```bash
python -m uvicorn main:app --reload
```

---

# Frontend Setup

```bash
cd anemia-frontend
```

## Install Frontend Dependencies

```bash
npm install
```

## Start React Frontend

```bash
npm start
```

---

# Disclaimer

This project is intended for educational and research purposes only.

It is **NOT** a replacement for professional medical diagnosis or laboratory testing.