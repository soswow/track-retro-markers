import { Global, css } from "@emotion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";

const globalStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: "SF Pro Text", "Segoe UI", sans-serif;
    background: #0f1419;
    color: #e8edf2;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  button {
    cursor: pointer;
  }
`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Global styles={globalStyles} />
    <App />
  </StrictMode>
);
