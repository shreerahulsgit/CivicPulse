# CivicPulse Installation Guide 🚀

This guide will walk you through installing and running CivicPulse from scratch on a new device.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your system:
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.10 or higher) - [Download here](https://www.python.org/)
- **MySQL Server** (Running locally) - [Download here](https://dev.mysql.com/downloads/installer/)
- **Git** - [Download here](https://git-scm.com/)

---

## 2. Clone the Repository

Open your terminal or command prompt and run:
```bash
git clone <your-repository-url>
cd CivicPulse
```

---

## 3. Database Setup (MySQL)

1. Open your MySQL client (e.g., MySQL Workbench, DBeaver, or terminal).
2. Create the database for the application:
   ```sql
   CREATE DATABASE civicpulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Ensure your MySQL server is running on the default port `3306`.

---

## 4. Backend Setup (FastAPI)

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend` folder. Add the following credentials (replace the placeholders with your actual details):
   ```env
   # Database Configuration (Replace <USERNAME> and <PASSWORD> with your MySQL credentials)
   DATABASE_URL=mysql+pymysql://<USERNAME>:<PASSWORD>@localhost:3306/civicpulse
   
   # Security (Generate a random string for this)
   JWT_SECRET_KEY=your_super_secret_key_here
   
   # Cloudinary (Required for image uploads)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
5. Run the database setup script to create all tables:
   ```bash
   python -c "import app.models; from app.database.connection import engine; from app.database.base import Base; Base.metadata.create_all(engine)"
   ```
6. Start the backend server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   *The backend API is now running at `http://localhost:8000`*

---

## 5. Frontend Setup (React & Vite)

1. Open a **new** terminal window (keep the backend running) and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend` folder with the following content:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The frontend web app is now running at `http://localhost:5173`*

---

## 6. Default Test Accounts

If you want to use the default testing accounts, you can run the seed script from the backend folder:
```bash
# Ensure your virtual environment is activated, then run:
python -m app.scripts.seed
```

**Available Accounts:**
- **Admin:** `admin@gcc.gov.in` | Password: `admin123`
- **Zonal Officer:** `zone1@gcc.gov.in` | Password: `officer123`
- **Ward Officer:** `ward1@gcc.gov.in` | Password: `officer123`
- **Citizen:** `citizen@example.com` | Password: `citizen123`
