import React, { useState } from 'react';
import './form.styles.css';

const MODES = ['Pedestrian', 'Bicyclist'] as const;
type Mode = typeof MODES[number];

const today = new Date().toISOString().slice(0, 10);
const startOfYear = `${new Date().getFullYear()}-01-01`;

const FormComponent: React.FC = () => {
  // Main fetch state
  const [mode, setMode] = useState<Mode>('Pedestrian');
  const [startDate, setStartDate] = useState<string>(startOfYear);
  const [endDate, setEndDate] = useState<string>(today);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [fetchSuccess, setFetchSuccess] = useState<string>('');

  // Debug section state
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [debugInput, setDebugInput] = useState<string>('');
  const [fixedJson, setFixedJson] = useState<string>('');
  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [debugError, setDebugError] = useState<string>('');

  const toApiDate = (d: string) => d.replace(/-/g, '');

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setFetchError('Please select both start and end dates.');
      return;
    }
    if (startDate > endDate) {
      setFetchError('Start date must be before end date.');
      return;
    }
    setIsFetching(true);
    setFetchError('');
    setFetchSuccess('');

    try {
      const response = await fetch('/api/fetch-and-generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          start_date: toApiDate(startDate),
          end_date: toApiDate(endDate),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crashmap_${mode.toLowerCase()}_${toApiDate(startDate)}_${toApiDate(endDate)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFetchSuccess('SQL file downloaded successfully.');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsFetching(false);
    }
  };

  const handleFixJson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugInput.trim()) {
      setDebugError('Please paste some JSON to fix.');
      return;
    }
    setIsFixing(true);
    setDebugError('');
    setFixedJson('');

    try {
      const response = await fetch('/api/fix-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ malformed_json: debugInput }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setFixedJson(data.fixed_json);
    } catch (err) {
      setDebugError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="form-container">
      <h1 className="app-title">CrashMap Data Pipeline</h1>
      <p className="app-subtitle">
        Fetch crash data from WSDOT and generate a SQL file for CrashMap import.
      </p>

      <form onSubmit={handleFetch} className="fetch-form">
        <div className="field-row">
          <div className="field-group">
            <label htmlFor="mode" className="input-label">Mode</label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="text-input"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="startDate" className="input-label">Start Date</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-input"
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="endDate" className="input-label">End Date</label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-input"
              required
            />
          </div>
        </div>

        <button type="submit" className="submit-button" disabled={isFetching}>
          {isFetching ? 'Fetching from WSDOT…' : 'Fetch from WSDOT & Download SQL'}
        </button>

        {fetchError && <div className="error-message">{fetchError}</div>}
        {fetchSuccess && <div className="success-message">{fetchSuccess}</div>}
      </form>

      <div className="debug-section">
        <button
          type="button"
          className="debug-toggle"
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? '▼' : '▶'} Debug: Fix Raw JSON
        </button>

        {showDebug && (
          <form onSubmit={handleFixJson} className="simple-form">
            <div className="input-group">
              <label htmlFor="debugInput" className="input-label">
                Paste malformed JSON:
              </label>
              <textarea
                id="debugInput"
                value={debugInput}
                onChange={(e) => setDebugInput(e.target.value)}
                placeholder="Paste your malformed JSON here..."
                className="text-input"
                rows={4}
              />
              <button type="submit" className="submit-button" disabled={isFixing}>
                {isFixing ? 'Fixing JSON…' : 'Fix JSON'}
              </button>
            </div>
            {debugError && <div className="error-message">{debugError}</div>}
            {fixedJson && (
              <div className="result-group">
                <label className="input-label">Fixed JSON:</label>
                <textarea
                  value={fixedJson}
                  readOnly
                  className="text-input result-textarea"
                  rows={8}
                />
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => navigator.clipboard.writeText(fixedJson)}
                >
                  Copy to Clipboard
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default FormComponent;
