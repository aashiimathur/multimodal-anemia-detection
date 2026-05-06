import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // ---------- Upload ----------
  const handleUpload = (e) => {
    const selected = e.target.files[0];
    setFile(selected);
    setAudioURL(URL.createObjectURL(selected));
  };

  // ---------- Recording ----------
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      setFile(blob);
      setAudioURL(URL.createObjectURL(blob));
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  // ---------- API ----------
  const handleSubmit = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file, "audio.webm");

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
      alert("Error sending audio to server");
    }
    setLoading(false);
  };

  const risk = result ? Math.min(100, Math.max(0, ((15 - result.hb) / 9) * 100)) : 0;

  function generateSummary(result) {
      let summary = "";

      const hb = result.hb;
      const shimmer = result.shimmer;
      const jitter = result.jitter;
      const hnr = result.hnr;
      const confidence = result.confidence;

      // Base on Hb
      if (hb >= 12) {
        summary += "Your estimated hemoglobin level appears to be within a normal range. ";
      } else if (hb >= 11) {
        summary += "Your hemoglobin level is slightly below normal, which may indicate mild anemia. ";
      } else if (hb >= 8) {
        summary += "Your hemoglobin level suggests moderate anemia. ";
      } else {
        summary += "Your hemoglobin level is quite low, indicating severe anemia. ";
      }

      // Feature reasoning
      if (shimmer > 0.04) {
        summary += "Your voice shows noticeable instability in amplitude. ";
      }

      if (jitter > 0.005) {
        summary += "There are slight irregularities in voice frequency. ";
      }

      if (hnr < 20) {
        summary += "The voice signal contains more noise than expected. ";
      }

      // Confidence context
      if (confidence < 60) {
        summary += "The model is less confident about this prediction, so results should be interpreted cautiously. ";
      } else if (confidence < 80) {
        summary += "The prediction has moderate confidence. ";
      } else {
        summary += "The model is highly confident in this prediction. ";
      }

      // Final note
      summary += "This analysis is based only on voice characteristics and should not be considered a medical diagnosis.";

      return summary;
    }

  return (
    <div className="app">

      <h1 className="title">Anemia Early Detection AI</h1>

      <div className="main-grid">

        {/* LEFT PANEL */}
        <div className="panel input-panel">

          <h2>🎤 Input</h2>

          <input type="file" onChange={handleUpload} />

          {!recording ? (
            <button onClick={startRecording}>🎤 Start Recording</button>
          ) : (
            <button onClick={stopRecording}>⏹ Stop Recording</button>
          )}

          {audioURL && <audio controls src={audioURL}></audio>}

          <button className="analyze" onClick={handleSubmit}>
            🔍 Analyze Voice
          </button>

        </div>

        {/* RIGHT PANEL */}
        <div className="panel result-panel">

          {!result && <p className="placeholder">Upload or record voice to begin</p>}

          {loading && <p>Processing...</p>}

          {result && (
            <>
              <div className={`prediction ${result.label.toLowerCase()}`}>
                {result.label}
              </div>

              <div className="stats">
                <div>🧪 Hb: {result.hb.toFixed(2)}</div>
                <div>📈 {result.confidence.toFixed(2)}%</div>
              </div>

              {/* Risk Bar */}
              <div className="risk-bar">
                <div className="risk-fill" style={{ width: `${risk}%` }}></div>
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
              </div>

              {/* Explanation */}
              <div className="explanation">
                {result.shimmer > 0.04 && <p>🔴 High shimmer → instability</p>}
                {result.jitter > 0.005 && <p>🟠 Jitter variation</p>}
                {result.hnr < 20 && <p>🔴 Low HNR → noisy voice</p>}
              </div>

              {/* Summary */}
              <div className="summary">
                {generateSummary(result)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;