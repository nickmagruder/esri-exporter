import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import './form.styles.css';

const MODES = ['Pedestrian', 'Bicyclist'] as const;
type Mode = typeof MODES[number];

const today = new Date().toISOString().slice(0, 10);
const startOfYear = `${new Date().getFullYear()}-01-01`;

const toApiDate = (d: string) => d.replace(/-/g, '');

interface FetchSqlVariables {
  mode: Mode;
  startDate: string;
  endDate: string;
}

interface FixJsonResult {
  fixed_json: string;
}

const FormComponent: React.FC = () => {
  const [mode, setMode] = useState<Mode>('Pedestrian');
  const [startDate, setStartDate] = useState<string>(startOfYear);
  const [endDate, setEndDate] = useState<string>(today);
  const [dateError, setDateError] = useState<string>('');

  // Debug section state
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [debugInput, setDebugInput] = useState<string>('');

  const fetchSqlMutation = useMutation<Blob, Error, FetchSqlVariables>({
    mutationFn: async ({ mode, startDate, endDate }) => {
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

      return response.blob();
    },
    onSuccess: (blob, { mode, startDate, endDate }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crashmap_${mode.toLowerCase()}_${toApiDate(startDate)}_${toApiDate(endDate)}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const fixJsonMutation = useMutation<FixJsonResult, Error, string>({
    mutationFn: async (malformedJson) => {
      const response = await fetch('/api/fix-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ malformed_json: malformedJson }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
  });

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError('');
    if (startDate > endDate) {
      setDateError('Start date must be before end date.');
      return;
    }
    fetchSqlMutation.mutate({ mode, startDate, endDate });
  };

  const handleFixJson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugInput.trim()) return;
    fixJsonMutation.mutate(debugInput);
  };

  return (
    <div className="form-container">
      <h1 className="app-title">ESRI Exporter</h1>
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

        <button
          type="submit"
          className="submit-button"
          disabled={fetchSqlMutation.isPending}
        >
          {fetchSqlMutation.isPending
            ? 'Fetching from WSDOT…'
            : 'Fetch from WSDOT & Download SQL'}
        </button>

        {dateError && <div className="error-message">{dateError}</div>}
        {fetchSqlMutation.isError && (
          <div className="error-message">{fetchSqlMutation.error.message}</div>
        )}
        {fetchSqlMutation.isSuccess && (
          <div className="success-message">SQL file downloaded successfully.</div>
        )}
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
              <button
                type="submit"
                className="submit-button"
                disabled={fixJsonMutation.isPending}
              >
                {fixJsonMutation.isPending ? 'Fixing JSON…' : 'Fix JSON'}
              </button>
            </div>
            {fixJsonMutation.isError && (
              <div className="error-message">{fixJsonMutation.error.message}</div>
            )}
            {fixJsonMutation.data && (
              <div className="result-group">
                <label className="input-label">Fixed JSON:</label>
                <textarea
                  value={fixJsonMutation.data.fixed_json}
                  readOnly
                  className="text-input result-textarea"
                  rows={8}
                />
                <button
                  type="button"
                  className="copy-button"
                  onClick={() =>
                    navigator.clipboard.writeText(fixJsonMutation.data!.fixed_json)
                  }
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
