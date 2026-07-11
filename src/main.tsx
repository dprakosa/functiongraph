import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setGlobalTheme } from "@atlaskit/tokens";
import App from "./App";
import { AuthShell } from "./auth/AuthShell";
import "./styles/app.css";
import "./auth/auth.css";

setGlobalTheme({ colorMode: "light", shape: "shape" });

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthShell publishableKey={clerkPublishableKey}>
      <App />
    </AuthShell>
  </StrictMode>,
);
