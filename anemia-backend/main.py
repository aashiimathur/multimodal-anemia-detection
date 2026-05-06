from fastapi import FastAPI, UploadFile, File
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
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
clf = joblib.load("anemia_classifier.pkl")
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

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    file_bytes = await file.read()

    features, jitter, shimmer, hnr, HBAI = extract_features(file_bytes)

    pred = clf.predict(features)[0]
    label = le.inverse_transform([pred])[0]

    hb = hb_model.predict(features)[0]
    confidence = float(np.max(clf.predict_proba(features)) * 100)

    return {
        "label": label,
        "hb": float(hb),
        "confidence": confidence,
        "jitter": float(jitter),
        "shimmer": float(shimmer),
        "hnr": float(hnr),
        "hbai": float(HBAI)
    }