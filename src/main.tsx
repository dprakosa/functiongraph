import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthShell } from "./auth/AuthShell";
import "./styles/app.css";
import "./auth/auth.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthShell publishableKey={clerkPublishableKey}>
      <App />
    </AuthShell>
  </StrictMode>,
);
