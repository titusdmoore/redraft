const Delta = Quill.import('delta');
import { Generation } from "./generation.js";

export class GenerationContext {
	#queuedOperations;
	#debounceTimer;
	#debounceTimeout = 500;

	// For now this property just tracks the latest generation, once I implement the logic for changing between generations, it will be handled with this property.
	#activeGeneration = null;

	constructor(contextOffset, initialDelta) {
		this.#queuedOperations = [];
		// Head indicates the starting index in parent editor of the generation. This allows us to place updated generations on text changes prior to generation location.
		// This will have to be updated if the editor has changes above starting location of generation.
		this.head = contextOffset;

		// Generation structure { pointer: int, delta: { ops: [] }, length: getter for calculating length from delta ops }
		// Pointer indicates a cursor starting from the start of the generation (or this.head), this helps delta creation.
		this.generations = [this.buildGeneration(initialDelta)];
		this.#activeGeneration = 0;
	}

	buildGeneration(delta) {
		return new Generation(delta);
	}

	// Takes deltas from editor and updates the latest generation.
	handleGenerationUpdate(op) {
		this.#queuedOperations.push(op);

		// This will handle the logic to prevent the computation for merging operations into a generation from running immediately on every keypress.
		(function() {
			clearTimeout(this.#debounceTimer);

			this.#debounceTimer = setTimeout(() => {
				this.generations[this.#activeGeneration].mergeOps(this.#queuedOperations);
				this.#queuedOperations = [];
			}, this.#debounceTimeout);
		}).apply(this);
	}

}
