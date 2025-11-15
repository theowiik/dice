import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

let app;

function init() {
	const target = document.getElementById("app");
	if (!target) {
		console.error("Target element #app not found");
		return;
	}

	app = mount(App, {
		target,
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}

export default app;
