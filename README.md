# SocialHub – SaaS Dashboard Platform with AI Generator

## Overview

**SocialHub** is a Software-as-a-Service (SaaS) data management and dashboard platform that helps users **centralize data**, **visualize insights**, and **automatically generate dashboards using AI** based on natural language descriptions.

The system is designed with a **modular architecture**, separating frontend and backend concerns. It uses **Node.js + Express** for the backend, **React + Vite + TypeScript** for the frontend, and a hybrid database approach with **PostgreSQL** and **MongoDB**.

This project was developed as a **Specialized Course Project in Software Engineering**.

---

## 🎯 Objectives

* Build a SaaS platform for flexible dashboard creation and data management
* Reduce dependency on technical skills by introducing an **AI Dashboard Generator**
* Apply RESTful API design, JWT authentication, and layered architecture
* Strengthen full-stack development and real-world system design skills

---

## Key Features

### User Features

* User registration, login, and password recovery (JWT-based authentication)
* Create dashboards from natural language descriptions using AI
* Manage dashboard data: tables, records, widgets, and insights
* AI Chat for data analysis and Q&A
* View and manage personal or shared dashboards
* Receive in-app notifications
* Submit, edit, or delete system reviews

### 🛠️ Admin Features

* User management (CRUD operations and role assignment)
* System-wide dashboard management
* Create and manage system notifications
* View system activity logs
* Lock, unlock, or remove dashboards and user accounts

---

## System Architecture

### General Architecture

* **Frontend**: React + Vite + TypeScript
* **Backend**: Node.js + Express (Monolithic with modular separation)
* **Databases**:

  * PostgreSQL: users, notifications, reviews, activity logs
  * MongoDB: dashboards, tables, records, AI conversations

### Backend Structure

```
Routes
 └── Controllers
      └── Services / Repositories
           └── Databases (PostgreSQL / MongoDB)
```

* RESTful API design
* Stateless authentication using JWT
* Role-based authorization via middleware (admin / user)

---

## 🤖 AI Dashboard Generator

* Users describe their reporting goals in natural language (e.g., "track monthly revenue")
* AI generates:

  * Dashboard structure
  * Suggested widgets and insights
* Generated dashboards are stored in MongoDB
* AI conversation history is preserved for future reference

---

## Testing

* Functional testing for:

  * Authentication (register, login, logout)
  * Dashboard CRUD operations
  * AI Chat and AI Generator
  * Admin portal functionalities
* API-level and business flow testing are applied

---

## Technology Stack

### Backend

* express
* jsonwebtoken
* bcryptjs
* pg
* mongodb / mongoose
* openai
* nodemailer
* multer
* zod

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* shadcn/ui
* lucide-react
* sonner

---

## Installation & Running the Project

### System Requirements

* Node.js >= 18
* PostgreSQL
* MongoDB
* npm or yarn

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

Create a `.env` file:

```env
PORT=5000
JWT_SECRET=your_secret
POSTGRES_URL=postgres://...
MONGODB_URI=mongodb://...
OPENAI_API_KEY=your_key
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## Scope & Limitations

* No multi-tenant (multi-organization) support
* No Docker or CI/CD pipeline
* No custom AI model training
* No Redis cache or message queue integration

---

## Future Enhancements

* Multi-organization (multi-tenant) architecture
* Real-time dashboards using WebSockets
* PDF / Excel export
* Advanced AI-driven insights
* CI/CD pipeline and Docker deployment
