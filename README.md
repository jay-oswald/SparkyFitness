# SparkyFitness Application

SparkyFitness is a comprehensive fitness tracking and management application designed to help users monitor their nutrition, exercise, and body measurements. It provides tools for daily progress tracking, goal setting, and insightful reports to support a healthy lifestyle.

## ✨ Features

*   **Nutrition Tracking**: 🍎 Log your daily food intake, create and manage custom foods and categories, view nutrition summaries, and analyze trends with interactive charts.
*   **Exercise Tracking**: 💪 Record your workouts, manage a comprehensive exercise database, and search for exercises.
*   **Water Intake Tracking**: 💧 Monitor your daily water consumption to stay hydrated.
*   **Body Measurements**: 📏 Track various body measurements, add custom measurements, and visualize progress with charts.
*   **Goal Setting**: 🎯 Set and manage your fitness and nutrition goals.
*   **Daily Progress**: 🗓️ Monitor your daily progress and check-in on your habits.
*   **AI Nutrition Coach & Chatbot**: 🤖 Interact with SparkyAI for personalized fitness and nutrition guidance. This includes adding food (even by uploading pictures), body measurements, steps, and exercise directly through AI, along with chat history management.
*   **User Authentication & Profile Management**: 🔒 Secure user authentication, profile switching, and family access management.
*   **Comprehensive Reports**: 📊 Generate detailed reports on your nutrition and measurement trends.
*   **Customizable Themes**: 🎨 Switch between light and dark themes.

## 🚀 Getting Started

To get the SparkyFitness application running on your local machine, follow these steps:

### Prerequisites

*   **Supabase Project**: You will need a Supabase project set up.
    *   **Create a new project on Supabase**: Go to [Supabase](https://app.supabase.com/) and create a new project. (You can also try setting up a local Supabase project if preferred.)
    *   Obtain your Supabase Project URL and Anon Key from your project settings (API section).
    *   **Important Note on Supabase Authentication:** Update your URL Configuration in Supabase Authentication settings to match your domain. This is crucial for your domain to work and for receiving email invites for sign-up. Supabase offers extensive security features and third-party SSO options; configure them as per your project's needs.
    *   **AI API Encryption Key:** AI API keys are stored using 256-bit encryption. To enable this, you need to generate strong key (`AI_API_ENCRYPTION_KEY`) and configure it as a secret in your Supabase Edge Functions environment variables.
    

Supabase CLI Installation:
    *   Install the Supabase CLI by following the instructions at: [https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=platform&platform=linux](https://supabase.com/docs/guides/local-development/cli/getting-started?queryGroups=platform&platform=linux)

### Installation

1.  **Clone the repository:**
    To get the latest development version, clone the main branch:
    ```sh
    git clone https://github.com/CodeWithCJ/SparkyFitness.git
    cd SparkyFitness
    ```
    For stable releases, please check the [releases page](https://github.com/CodeWithCJ/SparkyFitness/releases).

2.  **Supabase Login, Linking, Database Migration and Functions Deployment:**
    *   First, log in to Supabase via the CLI:
        ```sh
        supabase login
        ```
    *   Then, link your local project to your Supabase project:
        ```sh
        supabase link
        ```
        (If you have multiple projects, choose the one that you created in prior step)
    *   After linking, navigate to the root of the project and run the following commands to push the database schema. second command is optional but needed for chat bot to work.
        ```sh
        supabase db push
        supabase functions deploy chat
        ```

3.  **Configure Environment Variables:**
    Create a `.env` file under private folder. If you are using Portainer, directly create over there. 
    Add your Supabase credentials:
    ```
    VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
    VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

4.  **Run with Docker Compose:**
    Pull the Docker images and start the services:
    ```sh
    docker compose pull
    docker compose up -d
    ```

5.  **Access the Application:**
    Once the services are up and running, access SparkyFitness in your web browser at:
    ```
    http://localhost:3000
    ```

