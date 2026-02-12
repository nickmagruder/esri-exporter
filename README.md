## Upgrade to the Premium Version 🚀

Looking for advanced features and tools to accelerate your development process? Check out the **[Premium Python-React Starter Kit](https://zoefhall.gumroad.com/)**!

![Upgrade to Premium](https://github.com/ZoeFaithHall/README/blob/77e1cd1aa36be36f8a2ba037eaad58c55d30061d/Premium-Python-React-Starter-Kit.png)

### Premium Features:
- Full integration with GraphQL and Ariadne
- Advanced Tailwind UI components
- Optimized production-ready setup
- Best practices for testing, CI/CD, and deployment

👉 [Learn more and get the Premium Starter Kit now!](https://zoefhall.gumroad.com/)

# Python-React Starter Kit

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

2. Create and activate a virtual environment

```bash
`python3 -m venv venv` OR `python -m venv venv`

source venv/bin/activate  # On Windows: `venv\Scripts\activate`
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

**Verify the Setup:**

```bash
which python
which pip
```

4. Run the Flask app:

```bash
flask run
```

#### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

### Usage

 • Backend: **<http://127.0.0.1:5000>**
 • Frontend: **<http://127.0.0.1:5173>**

## Changelog

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

### License

This project is licensed under the MIT License.
