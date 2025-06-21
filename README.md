# SparkyFitness Application

SparkyFitness is a comprehensive fitness tracking and management application designed to help users monitor their nutrition, exercise, and body measurements. It provides tools for daily progress tracking, goal setting, and insightful reports to support a healthy lifestyle.

## ✨ Features

*   **Nutrition Tracking**: 🍎 Log your daily food intake, create custom foods, view nutrition summaries, and analyze trends with interactive charts.
*   **Exercise Tracking**: 💪 Record your workouts, manage an exercise database, and search for exercises.
*   **Body Measurements**: 📏 Track various body measurements, add custom measurements, and visualize progress with charts.
*   **Goal Setting**: 🎯 Set and manage your fitness and nutrition goals.
*   **Daily Progress**: 🗓️ Monitor your daily progress and check-in on your habits.
*   **AI Chatbot**: 🤖 Interact with SparkyAI for personalized fitness and nutrition guidance.
*   **User Authentication**: 🔒 Secure user authentication and profile management.
*   **Family Access**: 👨‍👩‍👧‍👦 Manage access for family members to share progress.
*   **Comprehensive Reports**: 📊 Generate detailed reports on your nutrition and measurement trends.
*   **Customizable Themes**: 🎨 Switch between light and dark themes.

## 🚀 Getting Started

To get the SparkyFitness application running on your local machine, follow these steps:

### Prerequisites

*   **Node.js**: Ensure you have Node.js (version 20 or higher recommended) installed. You can use `nvm` (Node Version Manager) for easy installation and management.
*   **Bun**: This project uses Bun for package management. Install Bun by following the instructions on their official website: [https://bun.sh/docs/installation](https://bun.sh/docs/installation)
*   **Supabase Project**: You will need a Supabase project set up.
    *   Create a new project on [Supabase](https://app.supabase.com/).
    *   Obtain your Supabase Project URL and Anon Key from your project settings (API section).
    *   Set up your database schema as defined in the `supabase/migrations` directory.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/SparkyFitness.git # Replace with your actual repo URL
    cd SparkyFitness
    ```

2.  **Install dependencies using Bun:**
    ```sh
    bun install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project based on `private/.env` (or `private/.env.example` if it exists).
    Add your Supabase credentials:
    ```
    VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
    VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

4.  **Run the development server:**
    ```sh
    bun run dev
    ```
    The application will be accessible at `http://localhost:5173` (or another port if 5173 is in use).

## 🐳 Running with Docker

This project can also be run using Docker and Docker Compose, which provides a consistent environment for development and deployment.

### Prerequisites

*   **Docker Desktop**: Ensure you have Docker Desktop installed, which includes Docker Engine and Docker Compose.

### Steps to run with Docker Compose

1.  **Download `docker-compose.yml`:**
    Ensure you have the `docker-compose.yml` file in the root of your project. If not, you can download it from the repository or create one with the necessary service definitions.

2.  **Configure Environment Variables for Docker:**
    Before running, ensure your Supabase environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) are set. You can do this by:
    *   Creating a `.env` file in the same directory as your `docker-compose.yml` and adding your variables there. Docker Compose will automatically pick these up.
        ```
        VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
        VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
        ```
    *   Alternatively, you can pass them directly when running the `docker run` command, or define them within the `docker-compose.yml` under the `environment` section for the `sparkyfitness-frontend` service.
    **Note**: For production environments, it's recommended to use Docker secrets or a `.env` file referenced by Docker Compose for sensitive information.

3.  **Build and run the Docker containers:**
    ```sh
    docker-compose up --build
    ```
    This command will:
    *   Build the Docker image for the frontend application (if not already built or if changes are detected).
    *   Start the `sparkyfitness-frontend` service.
    *   The application will be accessible at `http://localhost:3000`.

4.  **Stop the Docker containers:**
    ```sh
    docker-compose down
    ```
    This command will stop and remove the containers, networks, and volumes created by `up`.
