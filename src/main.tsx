import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthShell } from "./auth/AuthShell";
import { RootRouter } from "./routing/RootRouter";
import "./styles/app.css";
import "./styles/routes.css";
import "./auth/auth.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthShell publishableKey={clerkPublishableKey}>
      <RootRouter />
    </AuthShell>
  </StrictMode>,
);
