
<div align="right">
  <details>
    <summary >🌐 Language</summary>
    <div>
      <div align="right">
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=en">English</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=zh-CN">简体中文</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=zh-TW">繁體中文</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=ja">日本語</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=ko">한국어</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=hi">हिन्दी</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=th">ไทย</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=fr">Français</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=de">Deutsch</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=es">Español</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=it">Itapano</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=ru">Русский</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=pt">Português</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=nl">Nederlands</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=pl">Polski</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=ar">العربية</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=fa">فارسی</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=tr">Türkçe</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=vi">Tiếng Việt</a></p>
        <p><a href="https://openaitx.github.io/view.html?user=CodeWithCJ&project=SparkyFitness&lang=id">Bahasa Indonesia</a></p>
      </div>
    </div>
  </details>
</div>

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

- **Docker & Docker Compose** - For containerized deployment
- **Node.js & npm** - For local development (optional)
- **PostgreSQL** - Database (included in Docker setup)

### Installation

Choose your deployment method:

#### 🚀 Quick Start (Production)

For a production deployment using pre-built images from DockerHub:

1.  **Configure Environment Variables:**
    Create a `.env` file in the root directory. Copy the template from `docker/.env.example` and update it with your settings.

    ```bash
    # Copy the example file
    cp docker/.env.example .env
    
    # Key environment variables to configure:
    SPARKY_FITNESS_ADMIN_EMAIL=your-admin@email.com
    SPARKY_FITNESS_SERVER_HOST=sparky-fitness-server
    SPARKY_FITNESS_SERVER_PORT=3010
    ```

2.  **Start with Docker Helper:**
    ```bash
    # Run the helper script for production deployment
    ./docker/docker-helper.sh prod up
    ```
    
    Or use Docker Compose directly:
    ```bash
    docker-compose -f docker/docker-compose.prod.yml up -d
    ```

#### 🔧 Development Setup

For local development with live reloading:

1.  **Configure Environment Variables:**
    Create a `.env` file in the root directory from the template:

    ```bash
    cp docker/.env.example .env
    ```

2.  **Start Development Environment:**
    ```bash
    # Run the helper script for development
    ./docker/docker-helper.sh dev up
    
    # This will:
    # - Build images from local source code
    # - Enable live reloading for frontend (port 8080)
    # - Expose backend directly (port 3010) 
    # - Expose PostgreSQL (port 5432)
    ```

3.  **Alternative: Local Development (No Docker):**
    ```bash
    # Copy environment template
    cp docker/.env.example .env
    
    # Install dependencies
    npm install
    cd SparkyFitnessServer && npm install && cd ..
    
    # Start backend
    npm run start-backend
    
    # Start frontend (in another terminal)
    npm run dev
    ```

#### 📋 Docker Helper Commands

The `docker-helper.sh` script provides easy management:

```bash
# Show all available commands
./docker/docker-helper.sh

# Environment + Action combinations
./docker/docker-helper.sh [dev|prod] [up|down|build|logs|ps|clean]

# Examples:
./docker/docker-helper.sh dev up      # Start development
./docker/docker-helper.sh prod logs   # View production logs  
./docker/docker-helper.sh dev clean   # Clean up development containers
```

Refer to sample setup as reference: https://github.com/CodeWithCJ/SparkyFitness/wiki/Sample-Setup

#### 🌐 Access the Application

**Production (using docker-helper.sh prod up):**
- Frontend: `http://localhost:3004` or `http://your_domain:3004`

**Development (using docker-helper.sh dev up):**  
- Frontend: `http://localhost:8080` (with live reloading)
- Backend API: `http://localhost:3010`
- Database: `localhost:5432` (for direct access)

**Local Development (no Docker):**
- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:3010`

#### 🤖 AI Chatbot - Optional Configuration
To enable the AI Chatbot's full functionality, you will need to configure the necessary API keys within the application's settings after logging in.

#### ⚙️ Initial Application Setup
After logging into the application, navigate to the settings menu to:
- Add your preferred food providers (e.g., OpenFoodFacts is a free option)
- Adjust your preferences and profile settings
- Configure AI provider settings if using the chatbot

#### 🔧 Development Tools

**Useful Docker Commands:**
```bash
# View logs for all services
./docker/docker-helper.sh dev logs

# Check service status  
./docker/docker-helper.sh dev ps

# Rebuild after code changes (dev only)
./docker/docker-helper.sh dev build

# Clean up everything
./docker/docker-helper.sh dev clean
```

**Port Reference:**
- **Production**: Everything through port 3004
- **Development**: Frontend (8080), Backend (3010), Database (5432)  
- **Local**: Frontend (8080), Backend (3010)

### ⚠️ Known Issues / Beta Features ⚠️

The following features are currently in beta and may not have been thoroughly tested. Expect potential bugs or incomplete functionality:

*   AI Chatbot
*   Multi-user support
*   Family & Friends access
*   Apple Health Data integration

This application is under heavy development. Things may not work as expected due to the Supabase to PostgreSQL migration. BREAKING CHANGES might be introduced until the application is stable.
You might need to change Docker/environment variables for new releases. Therefore, auto-upgrades using Watchtower or similar apps are not recommended. Read release notes for any BREAKING CHANGES.


