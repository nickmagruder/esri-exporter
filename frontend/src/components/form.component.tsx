import React, { useState } from 'react';
import csvDownload from 'json-to-csv-export';
import exportFromJSON from 'export-from-json';
import './form.styles.css';

interface FormProps {
  onSubmit?: (value: string) => void;
}

const FormComponent: React.FC<FormProps> = ({ onSubmit }) => {
  const [inputValue, setInputValue] = useState<string>('');
  const [fixedJson, setFixedJson] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!inputValue.trim()) {
      setError('Please enter some text to fix');
      return;
    }

    setIsLoading(true);
    setError('');
    setFixedJson('');

    try {
      const response = await fetch('/api/fix-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          malformed_json: inputValue
        })
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            'Backend API not found. Make sure the Flask server is running on port 5000.'
          );
        }
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      setFixedJson(data.fixed_json);

      if (onSubmit) {
        onSubmit(data.fixed_json);
      }

      console.log('JSON fixed successfully:', data.fixed_json);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error fixing JSON:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="form-container">
      <div className="layout-wrapper">
        <div className="form-section">
          <form onSubmit={handleSubmit} className="simple-form">
            <div className="input-group">
              <button
                type="submit"
                className="submit-button"
                disabled={isLoading}
              >
                {isLoading ? 'Fixing JSON...' : 'Fix JSON'}
              </button>
              <label htmlFor="textInput" className="input-label">
                Paste malformed JSON:
              </label>
              <textarea
                id="textInput"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="Paste your malformed JSON here..."
                className="text-input"
                rows={1}
                style={{
                  minHeight: '2.5rem',
                  resize: 'none',
                  overflow: 'hidden'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
          </form>
        </div>

        <div className="result-section">
          {fixedJson && (
            <div className="result-group">
              <button
                type="button"
                className="copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(fixedJson);
                }}
              >
                Copy to Clipboard
              </button>
              <button
                type="button"
                className="copy-button"
                onClick={() => {
                  exportFromJSON({ data: JSON.parse(fixedJson), fileName: 'export', exportType: exportFromJSON.types.txt });
                }}
              >
                Export to .txt File
              </button>
              <button
                type="button"
                className="copy-button"
                onClick={() => {
                  csvDownload({ data: JSON.parse(fixedJson), filename: 'export' });
                }}
              >
                Export to .csv
              </button>
              <label className="input-label">Fixed JSON:</label>
              <textarea
                value={fixedJson}
                readOnly
                className="text-input result-textarea"
                rows={1}
                style={{
                  minHeight: '2.5rem',
                  resize: 'none',
                  overflow: 'hidden'
                }}
                onFocus={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormComponent;
