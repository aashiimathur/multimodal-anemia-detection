from fastapi import FastAPI, UploadFile, File, Form, HTTPException
import numpy as np
import joblib
import tempfile
import librosa
import parselmouth
import soundfile as sf
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware
import os
import subprocess
import cv2
import json
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
clf = joblib.load("anemia_classifier.pkl")
nail_clf = joblib.load("nail_anemia_classifier.pkl")
le = joblib.load("label_encoder.pkl")
hb_model = joblib.load("hb_model.pkl")

def extract_features(file_bytes):

    # Save input (webm or anything)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".input") as tmp:
        tmp.write(file_bytes)
        input_path = tmp.name

    # Convert to WAV using FFmpeg
    wav_path = input_path + ".wav"

    subprocess.run([
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        wav_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # ---------- LOAD WAV ----------
    y, sr = librosa.load(wav_path, sr=16000)

    # Clean
    y, _ = librosa.effects.trim(y)

    if len(y) < 4000:
        y = np.pad(y, (0, 4000 - len(y)))

    # MFCC
    mfcc = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)

    # ---------- PARSELMOUTH (NOW SAFE) ----------
    snd = parselmouth.Sound(wav_path)

    point = parselmouth.praat.call(
        snd, "To PointProcess (periodic, cc)", 75, 500
    )

    jitter = parselmouth.praat.call(
        point, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3
    )

    shimmer = parselmouth.praat.call(
        [snd, point], "Get shimmer (local)",
        0, 0, 0.0001, 0.02, 1.3, 1.6
    )

    harmonicity = parselmouth.praat.call(
        snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0
    )

    hnr = parselmouth.praat.call(
        harmonicity, "Get mean", 0, 0
    )

    # Fix NaN
    jitter = 0 if np.isnan(jitter) else jitter
    shimmer = 0 if np.isnan(shimmer) else shimmer
    hnr = 0 if np.isnan(hnr) else hnr

    HBAI = 0.63 * shimmer + 0.132 * jitter - 0.079 * hnr

    feature_names = [
        "jitter","shimmer","HNR","HBAI",
        "MFCC1","MFCC2","MFCC3","MFCC4","MFCC5","MFCC6",
        "MFCC7","MFCC8","MFCC9","MFCC10","MFCC11","MFCC12","MFCC13"
    ]

    features = np.concatenate(([jitter, shimmer, hnr, HBAI], mfcc))
    features = pd.DataFrame([features], columns=feature_names)

    return features, jitter, shimmer, hnr, HBAI

def extract_nail_features(image_path):

    img = cv2.imread(image_path)

    if img is None:
        raise ValueError("Image not found")

    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    img = cv2.resize(img, (200, 200))

    # center crop
    h, w, _ = img.shape

    img = img[
        int(h*0.15):int(h*0.85),
        int(w*0.15):int(w*0.85)
    ]

    mean_r = np.mean(img[:,:,0])
    mean_g = np.mean(img[:,:,1])
    mean_b = np.mean(img[:,:,2])

    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)

    mean_h = np.mean(hsv[:,:,0])
    mean_s = np.mean(hsv[:,:,1])
    mean_v = np.mean(hsv[:,:,2])

    std_r = np.std(img[:,:,0])

    features = np.array([
        mean_r,
        mean_g,
        mean_b,
        mean_h,
        mean_s,
        mean_v,
        std_r
    ]).reshape(1, -1)

    return features

@app.post("/predict")
async def predict(
    voice_file: UploadFile = File(None),
    nail_file: UploadFile = File(None),
    symptoms: str = Form("[]"),
    previous_hb: str = Form("")
):

    # ---------------- Check At Least One Input ----------------

    if voice_file is None and nail_file is None and symptoms == "[]" and previous_hb == "":
        raise HTTPException(
            status_code=400,
            detail="Please provide at least one input: voice, nail image, symptoms, or previous Hb."
        )

    # ---------------- Defaults ----------------

    label = "Not Available"
    hb = None
    confidence = 0
    jitter = 0
    shimmer = 0
    hnr = 0
    HBAI = 0
    voice_risk = 0
    voice_used = False

    nail_risk = 0
    nail_used = False

    symptom_risk = 0
    symptoms_list = []

    history_risk = 0
    hb_trend = "No previous Hb provided"
    history_used = False

    # ---------------- Symptoms ----------------

    symptoms_list = json.loads(symptoms)

    symptom_weights = {
        "Fatigue": 20,
        "Dizziness": 15,
        "Pale Skin": 25,
        "Headache": 10,
        "Shortness of Breath": 30
    }

    for symptom in symptoms_list:
        symptom_risk += symptom_weights.get(symptom, 0)

    symptom_risk = min(symptom_risk, 100)

    # ---------------- Voice ----------------

    if voice_file is not None:

        voice_used = True

        voice_bytes = await voice_file.read()

        features, jitter, shimmer, hnr, HBAI = extract_features(voice_bytes)

        pred = clf.predict(features)[0]

        label = le.inverse_transform([pred])[0]

        hb = hb_model.predict(features)[0]

        confidence = float(np.max(clf.predict_proba(features)) * 100)

        voice_risk = int(((15 - hb) / 9) * 100)

        voice_risk = max(0, min(100, voice_risk))

    # ---------------- Nail ----------------

    if nail_file is not None:

        nail_used = True

        nail_bytes = await nail_file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(nail_bytes)
            nail_path = tmp.name

        nail_features = extract_nail_features(nail_path)

        nail_prob = nail_clf.predict_proba(nail_features)[0][1]

        nail_risk = float(nail_prob * 100)

    # ---------------- Previous Hb ----------------

    if previous_hb != "":

        history_used = True

        try:
            previous_hb_value = float(previous_hb)

            if hb is not None:

                difference = hb - previous_hb_value

                if difference < -1:
                    history_risk = 30
                    hb_trend = "Hemoglobin appears to have decreased compared to previous value."

                elif difference > 1:
                    history_risk = 5
                    hb_trend = "Hemoglobin appears to have improved compared to previous value."

                else:
                    history_risk = 15
                    hb_trend = "Hemoglobin appears relatively stable."

            else:
                if previous_hb_value >= 12:
                    history_risk = 10
                    hb_trend = "Previous hemoglobin value appears to be within normal range."

                elif previous_hb_value >= 11:
                    history_risk = 35
                    hb_trend = "Previous hemoglobin value suggests mild anemia risk."

                elif previous_hb_value >= 8:
                    history_risk = 65
                    hb_trend = "Previous hemoglobin value suggests moderate anemia risk."

                else:
                    history_risk = 90
                    hb_trend = "Previous hemoglobin value suggests high anemia risk."

        except:
            history_risk = 0
            hb_trend = "Invalid previous Hb value."

    # ---------------- Dynamic Fusion ----------------

    total_weight = 0
    final_risk = 0

    if voice_used:
        final_risk += voice_risk * 0.5
        total_weight += 0.5

    if nail_used:
        final_risk += nail_risk * 0.2
        total_weight += 0.2

    if len(symptoms_list) > 0:
        final_risk += symptom_risk * 0.2
        total_weight += 0.2

    if history_used:
        final_risk += history_risk * 0.1
        total_weight += 0.1

    if total_weight > 0:
        final_risk = final_risk / total_weight
    else:
        final_risk = 0

    # ---------------- Overall Risk ----------------

    if final_risk < 30:
        overall_risk = "Low"

    elif final_risk < 60:
        overall_risk = "Moderate"

    else:
        overall_risk = "High"

    return {
        "label": label,
        "hb": float(hb) if hb is not None else None,
        "confidence": confidence,

        "voice_used": voice_used,
        "voice_risk": float(voice_risk),

        "nail_used": nail_used,
        "nail_risk": float(nail_risk),

        "symptom_risk": float(symptom_risk),
        "symptoms_used": symptoms_list,

        "history_used": history_used,
        "history_risk": float(history_risk),
        "hb_trend": hb_trend,

        "final_risk": float(final_risk),
        "overall_risk": overall_risk,

        "jitter": float(jitter),
        "shimmer": float(shimmer),
        "hnr": float(hnr),
        "hbai": float(HBAI)
    }