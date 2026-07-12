import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthShell } from "./auth/AuthShell";
import { RootRouter } from "./routing/RootRouter";
import "@fontsource-variable/inter";
import "./styles/index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthShell publishableKey={clerkPublishableKey}>
      <RootRouter />
    </AuthShell>
  </StrictMode>,
);
