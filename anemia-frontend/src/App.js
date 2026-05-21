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

    if (!selected) return;

    setFile(selected);
    setAudioURL(URL.createObjectURL(selected));
  };

  // ---------------- Upload Nail ----------------

  const handleNailUpload = (e) => {
    const selected = e.target.files[0];

    if (!selected) return;

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

      const recordedFile = new File([blob], "recording.webm", {
        type: "audio/webm",
      });

      setFile(recordedFile);
      setAudioURL(URL.createObjectURL(blob));

      stream.getTracks().forEach((track) => track.stop());
    };

    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    setRecording(false);
  };

  // ---------------- Symptoms ----------------

  const toggleSymptom = (symptom) => {
    if (symptoms.includes(symptom)) {
      setSymptoms(symptoms.filter((s) => s !== symptom));
    } else {
      setSymptoms([...symptoms, symptom]);
    }
  };

  // ---------------- Submit ----------------

  const handleSubmit = async () => {
    if (!file && !nailFile && symptoms.length === 0 && previousHb === "") {
      alert("Please provide at least one input");
      return;
    }

    const formData = new FormData();

    if (file) {
      formData.append("voice_file", file);
    }

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

    if (result.voice_used) {
      const hb = result.hb;
      const shimmer = result.shimmer;
      const jitter = result.jitter;
      const hnr = result.hnr;
      const confidence = result.confidence;

      if (hb >= 12) {
        summary +=
          "Your estimated hemoglobin level appears to be within a normal range. ";
      } else if (hb >= 11) {
        summary +=
          "Your hemoglobin level is slightly below normal, which may indicate mild anemia. ";
      } else if (hb >= 8) {
        summary += "Your hemoglobin level suggests moderate anemia. ";
      } else {
        summary +=
          "Your hemoglobin level is quite low, indicating severe anemia. ";
      }

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

      if (confidence < 60) {
        summary +=
          "The model is less confident about this prediction, so results should be interpreted cautiously. ";
      } else if (confidence < 80) {
        summary += "The prediction has moderate confidence. ";
      } else {
        summary += "The model is highly confident in this prediction. ";
      }
    } else {
      summary +=
        "Voice analysis was not included because no voice sample was uploaded. ";
    }

    if (result.nail_used) {
      if (result.nail_risk > 70) {
        summary +=
          "Nail pallor analysis detected significant paleness commonly associated with anemia. ";
      } else if (result.nail_risk > 40) {
        summary +=
          "Nail image analysis showed mild pallor-related changes. ";
      } else {
        summary +=
          "Nail image analysis showed low pallor indicators. ";
      }
    } else {
      summary +=
        "Nail pallor analysis was not included because no nail image was uploaded. ";
    }

    if (result.symptoms_used && result.symptoms_used.length > 0) {
      summary +=
        "Selected symptoms were also considered while calculating the final risk score. ";
    }

    if (result.history_used) {
      summary += result.hb_trend + " ";
    }

    summary +=
      "This analysis is based only on the provided inputs and should not be considered a medical diagnosis.";

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

          {audioURL && <audio controls src={audioURL}></audio>}

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
              "Shortness of Breath",
            ].map((symptom) => (
              <label key={symptom} className="symptom-item">
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

          <button className="analyze" onClick={handleSubmit}>
            Analyze
          </button>
        </div>

        {/* RIGHT PANEL */}

        <div className="panel result-panel">
          {!result && (
            <p className="placeholder">
              Provide any input to begin analysis
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

              <div className={`prediction ${result.overall_risk.toLowerCase()}`}>
                {result.voice_used ? result.label : `${result.overall_risk} Risk`}
              </div>

              {/* Stats */}

              {result.voice_used && (
                <div className="stats">
                  <div>
                    🧪 Hb: {result.hb.toFixed(2)}
                  </div>

                  <div>
                    📈 Confidence: {result.confidence.toFixed(2)}%
                  </div>
                </div>
              )}

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
                  Final Risk Score: {result.final_risk.toFixed(2)}
                </p>

                {result.voice_used && (
                  <p>
                    Voice Risk: {result.voice_risk.toFixed(2)}
                  </p>
                )}

                {result.nail_used && (
                  <p>
                    Nail Risk: {result.nail_risk.toFixed(2)}
                  </p>
                )}

                {result.symptoms_used.length > 0 && (
                  <p>
                    Symptom Risk: {result.symptom_risk.toFixed(2)}
                  </p>
                )}

                {result.history_used && (
                  <p>
                    History Risk: {result.history_risk.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Biomarkers */}

              <div className="biomarkers">
                {result.voice_used && (
                  <>
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
                  </>
                )}

                {result.nail_used && (
                  <div className="bio-card nail-card">
                    <h4>Nail Analysis</h4>
                    <p>{result.nail_risk.toFixed(2)}%</p>
                    <span>Pallor Risk</span>
                  </div>
                )}
              </div>

              {/* Symptoms */}

              {result.symptoms_used.length > 0 && (
                <div className="symptoms-used">
                  <h3>Symptoms Considered</h3>

                  {result.symptoms_used.map((s, i) => (
                    <span key={i} className="symptom-badge">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Explanation */}

              <div className="explanation">
                {result.voice_used ? (
                  <>
                    {result.shimmer > 0.04 && (
                      <p>🔴 High shimmer → vocal instability</p>
                    )}

                    {result.jitter > 0.005 && (
                      <p>🟠 Jitter variation detected</p>
                    )}

                    {result.hnr < 20 && (
                      <p>🔴 Low HNR → noisy voice signal</p>
                    )}
                  </>
                ) : (
                  <p>⚪ Voice analysis was not included.</p>
                )}

                {result.nail_used ? (
                  <>
                    {result.nail_risk > 70 && (
                      <p>
                        🔴 Significant nail pallor detected suggesting possible anemia.
                      </p>
                    )}

                    {result.nail_risk > 40 &&
                      result.nail_risk <= 70 && (
                        <p>
                          🟠 Mild nail pallor detected with moderate anemia-related indicators.
                        </p>
                      )}

                    {result.nail_risk <= 40 && (
                      <p>
                        🟢 Nail image analysis shows low pallor indicators.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    ⚪ Nail image was not uploaded, so nail pallor analysis was not included.
                  </p>
                )}

                {result.symptoms_used.length > 0 && (
                  <p>
                    🩺 Symptom information was included in the final risk calculation.
                  </p>
                )}

                {result.history_used && (
                  <p>
                    🩸 Previous hemoglobin history was included in the final risk calculation.
                  </p>
                )}
              </div>

              {/* Summary */}

              <div className="summary">
                {generateSummary(result)}
              </div>

              {result.history_used && (
                <div className="trend-box">
                  <h3>Hb Trend Analysis</h3>
                  <p>{result.hb_trend}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;