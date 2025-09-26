import React, { useState } from 'react';
import './form.styles.css';

interface FormProps {
  onSubmit?: (value: string) => void;
}

const FormComponent: React.FC<FormProps> = ({ onSubmit }) => {
  const [inputValue, setInputValue] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(inputValue);
    }
    console.log('Form submitted with value:', inputValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit} className="simple-form">
        <div className="input-group">
          <button type="submit" className="submit-button">
            Submit
          </button>
          <label htmlFor="textInput" className="input-label">
            Paste text:
          </label>
          <textarea
            id="textInput"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type something here..."
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
      </form>
    </div>
  );
};

export default FormComponent;
