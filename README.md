# ESRI Exporter

An application for capturing and converting map data from ESRI map applications. Currently, this application works just for capturing crash data from the WSDOT ESRI map for the purposed of reusing the data in a more full-featured app I'm building called CrashMap.

WSDOT Map:
<https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/>

CrashMap:
<https://github.com/nickmagruder/crashmap>

The application follows a full-stack monorepo structure with a React/TypeScript frontend (built with Vite and styled with Tailwind CSS) and a Python Flask backend. The two layers communicate via a REST API: a Vite dev proxy routes `/api` requests to Flask during development, keeping the frontend and backend independently deployable. The frontend uses functional React components with local `useState` hooks for form state. No global state manager is needed given the single-feature scope. The core backend logic is a JSON normalization pipeline that unwraps the double-encoded, over-escaped JSON that ESRI map exports produce, returning clean, human-readable output suitable for downstream use.

## Built starting with the Python-React Starter Kit

A simple template for building full-stack applications with Python and React.

## Features

- **Backend**: Flask (Python)
- **Frontend**: React
- **Tooling**: Vite for fast frontend builds
- **Styling**: TailwindCSS
- **Clean Code**: ESLint

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.8 or higher

### Installation

#### Backend Setup

1. Navigate to the `backend` directory:

```bash
   cd backend
```

1. Create and activate a virtual environment

```bash
`python3 -m venv venv` OR `python -m venv venv`

source venv/bin/activate  # On Windows: `venv\Scripts\activate`
```

1. Install dependencies:

```bash
pip install -r requirements.txt
```

**Verify the Setup:**

```bash
which python
which pip
```

1. Run the Flask app:

```bash
flask run
```

#### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

1. Install dependencies:

```bash
npm install
```

1. Start the development server:

```bash
npm run dev
```

### Usage

 • Backend: **<http://127.0.0.1:5000>**
 • Frontend: **<http://127.0.0.1:5173>**

## Changelog

### 2026-02-12 - Add CSV & TXT exports

- Added "Export to .csv" button that downloads fixed JSON as a `.csv` file using `json-to-csv-export`
- Added "Export to .txt File" button that downloads fixed JSON as a `.txt` file using `export-from-json`

### 2026-02-12 - Dependency cleanup and updates

- Fixed duplicate entries in `package.json` (`react`, `react-dom`, `tailwindcss`, `@vitejs/plugin-react`)
- Moved build tools (`tailwindcss`, `autoprefixer`, `postcss`) from `dependencies` to `devDependencies`
- Updated all packages to latest minor/patch versions:
  - `@eslint/js` 9.17.0 → 9.39.2
  - `@types/react` 18.3.18 → 18.3.28
  - `@types/react-dom` 18.3.5 → 18.3.7
  - `@vitejs/plugin-react` 4.3.4 → 4.7.0
  - `autoprefixer` 10.4.20 → 10.4.24
  - `eslint-plugin-react-hooks` 5.1.0 → 5.2.0
  - `postcss` 8.4.49 → 8.5.6
  - `react-router-dom` 6.28.1 → 6.30.3
  - `tailwindcss` 3.4.17 → 3.4.19
  - `typescript` 5.7.2 → 5.9.3
  - `vite` 6.0.7 → 6.4.1
- Resolved all 9 npm audit vulnerabilities (now 0)
- Fixed build command for Netlify Deloyment
- Updated Readme

### License

This project is licensed under the MIT License.
