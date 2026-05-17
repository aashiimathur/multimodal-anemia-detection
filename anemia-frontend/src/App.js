import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {

  const [file, setFile] = useState(null);
  const [nailFile, setNailFile] = useState(null);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [symptoms, setSymptoms] = useState([]);
  const [previousHb, setPreviousHb] = useState("");
  const [recording, setRecording] = useState(false);

  const [audioURL, setAudioURL] = useState(null);

  const mediaRecorderRef = useRef(null);

  const audioChunksRef = useRef([]);

  // ---------------- Upload Voice ----------------

  const handleUpload = (e) => {

    const selected = e.target.files[0];

    setFile(selected);

    setAudioURL(URL.createObjectURL(selected));
  };

  // ---------------- Upload Nail ----------------

  const handleNailUpload = (e) => {

    const selected = e.target.files[0];

    setNailFile(selected);
  };

  // ---------------- Recording ----------------

  const startRecording = async () => {

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const recorder = new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;

    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {

      audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {

      const blob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      const recordedFile = new File(
        [blob],
        "recording.webm",
        {
          type: "audio/webm",
        }
      );

      setFile(recordedFile);

      setAudioURL(URL.createObjectURL(blob));
    };

    recorder.start();

    setRecording(true);
  };

  const stopRecording = () => {

    mediaRecorderRef.current.stop();

    setRecording(false);
  };

  const toggleSymptom = (symptom) => {

  if (symptoms.includes(symptom)) {

    setSymptoms(
      symptoms.filter((s) => s !== symptom)
    );

  } else {

    setSymptoms([...symptoms, symptom]);
  }
};

  // ---------------- Submit ----------------

  const handleSubmit = async () => {

    if (!file) {
      alert("Please upload or record audio");
      return;
    }

    const formData = new FormData();

    formData.append("voice_file", file);

    if (nailFile) {
      formData.append("nail_file", nailFile);
    }

    formData.append("symptoms", JSON.stringify(symptoms));
    formData.append("previous_hb", previousHb || "");

    setLoading(true);

    try {

      const res = await axios.post(
        "http://127.0.0.1:8000/predict",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(res.data);

    } catch (err) {

      console.error(err);

      alert("Error sending data to server");
    }

    setLoading(false);
  };

  // ---------------- Summary ----------------

  function generateSummary(result) {

    let summary = "";

    const hb = result.hb;

    const shimmer = result.shimmer;

    const jitter = result.jitter;

    const hnr = result.hnr;

    const confidence = result.confidence;

    // Hb

    if (hb >= 12) {

      summary +=
        "Your estimated hemoglobin level appears to be within a normal range. ";

    } else if (hb >= 11) {

      summary +=
        "Your hemoglobin level is slightly below normal, which may indicate mild anemia. ";

    } else if (hb >= 8) {

      summary +=
        "Your hemoglobin level suggests moderate anemia. ";

    } else {

      summary +=
        "Your hemoglobin level is quite low, indicating severe anemia. ";
    }

    // Voice

    if (shimmer > 0.04) {

      summary +=
        "Your voice shows noticeable instability in amplitude. ";
    }

    if (jitter > 0.005) {

      summary +=
        "There are slight irregularities in voice frequency. ";
    }

    if (hnr < 20) {

      summary +=
        "The voice signal contains more noise than expected. ";
    }

    // Nail

    if (result.nail_risk > 70) {

        summary +=
          "Nail pallor analysis detected significant paleness commonly associated with anemia. ";
      } else if (result.nail_risk > 40) {
        summary +=
          "Nail image analysis showed mild pallor-related changes. ";
      } else {

        summary +=
          "Nail coloration appeared relatively healthy with low pallor indicators. ";
      }

    // Confidence

    if (confidence < 60) {

      summary +=
        "The model is less confident about this prediction, so results should be interpreted cautiously. ";

    } else if (confidence < 80) {

      summary +=
        "The prediction has moderate confidence. ";

    } else {

      summary +=
        "The model is highly confident in this prediction. ";
    }

    summary +=
      "This analysis is based only on voice and nail characteristics and should not be considered a medical diagnosis.";

    return summary;
  }

  return (

    <div className="app">

      <h1 className="title">
        AI-Based Multi-Modal Anemia Detection
      </h1>

      <div className="main-grid">

        {/* LEFT PANEL */}

        <div className="panel input-panel">

          <h2>Voice Input</h2>

          <input
            type="file"
            accept="audio/*"
            onChange={handleUpload}
          />

          {!recording ? (

            <button onClick={startRecording}>
              🎤 Start Recording
            </button>

          ) : (

            <button onClick={stopRecording}>
              ⏹ Stop Recording
            </button>
          )}

          {audioURL && (
            <audio controls src={audioURL}></audio>
          )}

          <h2 style={{ marginTop: "30px" }}>
            Nail Image
          </h2>

          <input
            type="file"
            accept="image/*"
            onChange={handleNailUpload}
          />

          {nailFile && (
          <div className="nail-preview">
            <img
              src={URL.createObjectURL(nailFile)}
              alt="Nail Preview"
              className="nail-image"
            />
            <p>{nailFile.name}</p>

          </div>
        )}

        <h2 style={{ marginTop: "30px" }}>
          Symptoms
        </h2>

        <div className="symptom-list">

          {[
            "Fatigue",
            "Dizziness",
            "Pale Skin",
            "Headache",
            "Shortness of Breath"
          ].map((symptom) => (

            <label
              key={symptom}
              className="symptom-item"
            >

              <input
                type="checkbox"
                checked={symptoms.includes(symptom)}
                onChange={() => toggleSymptom(symptom)}
              />

              {symptom}

            </label>
          ))}

        </div>

        <h2 style={{ marginTop: "30px" }}>
          Previous Hemoglobin
        </h2>

        <input
          type="number"
          step="0.1"
          placeholder="Enter previous Hb (optional)"
          value={previousHb}
          onChange={(e) => setPreviousHb(e.target.value)}
          className="hb-input"
        />

          <button
            className="analyze"
            onClick={handleSubmit}
          >
            Analyze
          </button>

        </div>

        {/* RIGHT PANEL */}

        <div className="panel result-panel">

          {!result && (
            <p className="placeholder">
              Upload voice and nail image to begin
            </p>
          )}

          {loading && (
            <p className="processing">
              Processing AI analysis...
            </p>
          )}

          {result && (
            <>
              {/* Prediction */}
              <div className={`prediction ${result.label.toLowerCase()}`}>
                {result.label}
              </div>

              {/* Stats */}
              <div className="stats">
                <div>
                  🧪 Hb:
                  {" "}
                  {result.hb.toFixed(2)}
                </div>
                <div>
                  📈 Confidence:
                  {" "}
                  {result.confidence.toFixed(2)}%
                </div>
              </div>

              {/* Risk */}
              <div className="risk-section">
                <h3>Overall Risk: {result.overall_risk}</h3>
                <div className="risk-bar">
                  <div
                    className="risk-fill"
                    style={{
                      width: `${result.final_risk}%`,
                    }}
                  ></div>
                </div>
                <p>
                  Final Risk Score:
                  {" "}
                  {result.final_risk.toFixed(2)}
                </p>
                <p>
                  Symptom Risk:
                  {" "}
                  {result.symptom_risk.toFixed(2)}
                </p>
                <p>
                  History Risk:
                  {" "}
                  {result.history_risk.toFixed(2)}
                </p>
              </div>

              {/* Biomarkers */}

              <div className="biomarkers">
                <div className="bio-card">
                  <h4>Shimmer</h4>
                  <p>{result.shimmer.toFixed(4)}</p>
                </div>
                <div className="bio-card">
                  <h4>Jitter</h4>
                  <p>{result.jitter.toFixed(4)}</p>
                </div>
                <div className="bio-card">
                  <h4>HNR</h4>
                  <p>{result.hnr.toFixed(2)}</p>
                </div>
                <div className="bio-card nail-card">
                  <h4>Nail Analysis</h4>
                  <p>{result.nail_risk.toFixed(2)}%</p>
                  <span>
                    Pallor Risk
                  </span>
                </div>
              </div>
              <div className="symptoms-used">
                <h3>Symptoms Considered</h3>
                {result.symptoms_used.length === 0 ? (
                  <p>No symptoms selected</p>
                ) : (
                  result.symptoms_used.map((s, i) => (
                    <span
                      key={i}
                      className="symptom-badge"
                    >
                      {s}
                    </span>
                  ))
                )}
              </div>
              {/* Explanation */}
              <div className="explanation">
                {result.shimmer > 0.04 &&
                  <p>🔴 High shimmer → vocal instability</p>}
                {result.jitter > 0.005 &&
                  <p>🟠 Jitter variation detected</p>}
                {result.hnr < 20 &&
                  <p>🔴 Low HNR → noisy voice signal</p>}
                {result.nail_risk > 70 && (
                  <p>🔴 Significant nail pallor detected suggesting possible anemia.</p>
                )}

                {result.nail_risk > 40 && result.nail_risk <= 70 && (
                  <p>🟠 Mild nail pallor detected with moderate anemia-related indicators.</p>
                )}

                {result.nail_risk <= 40 && (
                  <p>🟢 Nail coloration appears relatively healthy.</p>
                )}
              </div>
              {/* Summary */}
              <div className="summary">
                {generateSummary(result)}
              </div>
              <div className="trend-box">
                <h3>Hb Trend Analysis</h3>
                <p>{result.hb_trend}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;