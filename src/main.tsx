
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/login.css";
import { Toaster } from "./components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster position="top-center" richColors />
  </>
);
  




