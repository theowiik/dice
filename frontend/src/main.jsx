import React from "react";
import ReactDOM from "react-dom/client";
import "./app.css";
import App from "./App.jsx";

const target = document.getElementById("app");
if (!target) throw new Error("Target element #app not found");

ReactDOM.createRoot(target).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
