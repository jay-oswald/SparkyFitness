# SparkyFitness - Selfhosted alternative of MyFitnessPal

SparkyFitness is a comprehensive fitness tracking and management application designed to help users monitor their nutrition, exercise, and body measurements. It provides tools for daily progress tracking, goal setting, and insightful reports to support a healthy lifestyle.


## ✨ Features

### 🍎 Nutrition Tracking

* **Log your daily meals**
* **Create and manage custom foods and categories**
* **View summaries and analyze trends with interactive charts**

### 💪 Exercise Logging

* **Record your workouts**
* **Browse and search a comprehensive exercise database**
* **Track fitness progress over time**

### 💧 Water Intake Monitoring

* **Track daily hydration goals**
* **Simple, quick water logging**

### 📏 Body Measurements

* **Record body metrics** (e.g. weight, waist, arms)
* **Add custom measurement types**
* **Visualize progress through charts**

### 🎯 Goal Setting

* **Set and manage fitness and nutrition goals**
* **Track progress over time**

### 🗓️ Daily Check-Ins

* **Monitor daily activity**
* **Stay consistent with habit tracking**

### 🤖 AI Nutrition Coach (SparkyAI)

* **Log food, exercise, body stats, and steps via chat**
* **Upload food images to log meals automatically**
* **Includes chat history and personalized guidance**

### 🔒 User Authentication & Profiles

* **Secure login system**
* **Switch between user profiles**
* **Support for family access and management**

### 📊 Comprehensive Reports

* **Generate summaries for nutrition and body metrics**
* **Track long-term trends over weeks or months**

### 🎨 Customizable Themes

* **Switch between light and dark mode**
* **Designed with a minimal, distraction-free interface**

### Need Help?
* **Join discord**
  https://discord.gg/vcnMT5cPEA
* **Post in discussion**


![image](https://github.com/user-attachments/assets/ccc7f34e-a663-405f-a4d4-a9888c3197bc)


## 🚀 Getting Started

To get the SparkyFitness application running on your local machine, follow these steps:

### Prerequisites

### Installation

1.  **Configure Environment Variables:**
    Create a `.env` file in the root directory of the project (where `docker-compose.yml` is located).
    Copy the contents of `.env.example` into your new `.env` file and fill in the appropriate values.

    **Key Environment Variables to Configure:**
    *   `SPARKY_FITNESS_SERVER_URL`: The full URL to your backend server (e.g., `http://your_backend_ip_or_domain:3010`). This is used by the frontend to connect to the backend.
    *   `SPARKY_FITNESS_FRONTEND_URL`: The full URL of your frontend application (e.g., `http://your_frontend_ip_or_domain:3004`). This is used by the backend for CORS configuration to allow requests from your frontend.
    *   `SPARKY_FITNESS_DB_NAME`, `SPARKY_FITNESS_DB_USER`, `SPARKY_FITNESS_DB_PASSWORD`: Database credentials.  Try not to change anything as I didn't test properly. Go with defaults
    *   `SPARKY_FITNESS_API_ENCRYPTION_KEY`, `JWT_SECRET`: Security keys for the backend. Use the command given in the example env file to generate keys. Otherwise App will fail due to security constraints

2.  **Run with Docker Compose:**
    Pull the Docker images and start the services. If you've made changes to the `.env` file, you should rebuild the images to ensure the new environment variables are picked up.
    ```sh
    docker-compose pull # Pull the latest Docker images
    docker-compose up -d # Start the services in detached mode
    ```
   

3.  **Access the Application:**
    Once the services are up and running, access SparkyFitness in your web browser at the URL configured for your frontend (e.g., `http://localhost:3004` or `http://your_frontend_ip_or_domain:3004`).

4.  **AI Chatbot - Optional Configuration:**
    To enable the AI Chatbot's full functionality, you will need to configure the necessary API keys within the application's settings after logging in.
    
### ⚠️ Known Issues / Beta Features

The following features are currently in beta and may not have been thoroughly tested. Expect potential bugs or incomplete functionality:

*   AI Chatbot
*   Multi-user support
*   Family & Friends access
*   Apple Health Data integration

This application is intended for beta testing purposes.


