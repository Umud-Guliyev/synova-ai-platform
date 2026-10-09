# SYNOVA AI

**Know the delay before it happens.**

SYNOVA AI is an AI-powered delivery and installation intelligence platform designed to help retail operations teams identify at-risk orders, understand potential delays, and prioritize preventive interventions.

Built for the **NeuroBridge Hackathon — AI Enterprise Solutions Track**.

## Overview

A delivery marked as complete does not always mean the entire customer journey is finished. Installation may still be pending, scheduling may be delayed, or operational issues may put an order at risk.

SYNOVA AI brings order risk monitoring, explainable risk analysis, experimental machine learning predictions, and intervention tracking into one operational workspace.

## Key Features

* **Order Risk Monitor** — Review orders by risk level, status, and operational indicators.
* **Explainable Risk Analysis** — Understand the factors contributing to an order's risk score.
* **ML Predictions** — Request experimental delivery and installation delay predictions.
* **Intervention Center** — Track preventive actions and their statuses.
* **Analytics Dashboard** — Explore order, fulfillment, delivery, and installation summaries.
* **Synthetic Demo Data** — Explore the product without connecting real customer or operational records.
* **Authentication** — Access the application through its login, registration, and demo flows.

## Core Workflow

1. **Predict** — Identify orders that may require attention.
2. **Explain** — Review the operational factors behind the risk.
3. **Prevent** — Prioritize and track potential interventions.

## Technology Stack

Update this list to match the dependencies and configuration in the repository.

* React
* TypeScript
* Vite
* Tailwind CSS
* Lovable Cloud authentication and backend services
* FastAPI-based external ML prediction API
* scikit-learn

## Machine Learning

SYNOVA AI integrates separate machine learning models for delivery and installation delay prediction.

The models were trained on synthetic data and are intended for demonstration and experimentation.

**Important limitations:**

* Predictions have not been validated against real-world operational data.
* Model scores are not calibrated real-world probabilities.
* Risk scores and ML prediction scores serve different purposes.
* Intervention tracking in the demo is session-only and resets when the session is reloaded.

The platform is a decision-support prototype, not an autonomous operational decision-maker.

## Demo Data

The current demo uses synthetic order records. Names, operational details, and prediction inputs are illustrative rather than real customer data.

The demo allows users to explore the order monitoring, risk analysis, intervention, and analytics workflows without requiring a live retail integration.

## Getting Started

### Prerequisites

* Node.js
* npm

### Installation

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Use the local URL printed by Vite to open the application.

### Environment Variables

Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key. The `VITE_` variables are used by the browser; the unprefixed variables are used by the server. Never put a secret key in a `VITE_` variable.

For local development against the cloud project, enable **Authentication → Sign In / Providers → Anonymous Sign-Ins** in Supabase. This is required by the Explore Demo button. When running a local Supabase stack instead, `supabase/config.toml` enables anonymous sign-ins for that stack.

In **Authentication → URL Configuration**, set the Site URL to the deployed app URL and add the exact local and Vercel app URLs to Additional Redirect URLs. Include each Vercel preview hostname you intend to use; email confirmation redirects to the current app origin.

### Vercel Deployment

Import the repository into Vercel and use `npm run build` as the build command. Nitro detects Vercel during deployment, so no Vercel-specific adapter or `vercel.json` is required for this app.

Add these variables in Vercel for **Production**, **Preview**, and **Development** as needed:

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_PUBLISHABLE_KEY`
* `SUPABASE_URL`
* `SUPABASE_PUBLISHABLE_KEY`

If a server-only admin operation is added, also set `SUPABASE_SERVICE_ROLE_KEY` to the Supabase secret key. Keep it server-side and never prefix it with `VITE_`. Do not commit `.env.local` or other credential files.

## Project Structure

The exact structure may vary, but the application includes modules for:

* Application routes and layouts
* Order monitoring and details
* Risk analysis
* Machine learning predictions
* Intervention tracking
* Analytics
* Authentication
* Synthetic demo data and tests

## Responsible Use

SYNOVA AI is an experimental prototype. Its synthetic data and model outputs demonstrate a proposed workflow; they do not prove reduced delivery delays, financial savings, or improved real-world business performance.

A real-world pilot and evaluation using historical operational data would be required before relying on the platform for production decisions.

## Project

**SYNOVA AI**
*Know the delay before it happens.*

Built for the NeuroBridge Hackathon, Baku, 2026.
