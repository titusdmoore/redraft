import './editor/formats/boldBlot.js';
import './editor/formats/italicBlot.js';
import './editor/formats/linkBlot.js';
import './editor/formats/generationBlot.js';

import './editor/modules/generationContextModule.js';
import { devInit } from './editor/dev.js';

const quill = new Quill('#editor', {
	modules: {
		generationContextTracker: true
	},
});

// NOTE: BEGUG only bind quill instance to window
window.debugQuill = quill;
devInit();

function handleCustomValue(type) {
	switch (type) {
		case "generation":
			return Math.floor(Math.random() * 50);
		default:
			return true;

	}
}

document.addEventListener("DOMContentLoaded", () => {
	// Register all controls for formatting and binds for formatting action.
	document.querySelectorAll("menu button").forEach(el => {
		el.addEventListener("click", () => {
			quill.format(el.dataset.formatType, handleCustomValue(el.dataset.formatType));
		});
	});
});
