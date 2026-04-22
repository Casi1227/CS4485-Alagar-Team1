# BudgetWise Frontend

This directory contains the frontend for the **BudgetWise** application.

The original UI layout was exported from a Figma design and is currently being integrated into the unified project structure after recent repository merges.

Original design source:
https://www.figma.com/design/5dzBPsxEaWj4W081JD01pV/Budget-Tracking-Dashboard--Copy-

---

## Running the frontend locally

Install dependencies:

npm install

Start the development server:

npm run dev

Optional demo mode for Plaid direct import (skip Plaid Link UI):

Set NEXT_PUBLIC_PLAID_DEMO_DIRECT_IMPORT_ENABLED="true" in frontend/.env.local
(requires matching backend flag PLAID_DEMO_DIRECT_IMPORT_ENABLED="true").

The application will run at:

http://localhost:3000

---

## Frontend structure

app/
Main application routes and page layouts.

src/
Reusable components and frontend logic.

guidelines/
Documentation related to development workflow and frontend structure.

---

## Current frontend focus

The frontend is currently being aligned with the unified application structure after recent branch merges.

Current work includes:

• Dashboard UI integration  
• Expense tracking interface  
• Budget / calendar views  
• Connecting frontend components to backend API endpoints

---

## Notes

This frontend originated from a Figma export and will continue to be cleaned up as the project progresses.  
Future work will focus on integrating backend data and refining the UI components.
