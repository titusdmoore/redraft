const Delta = Quill.import('delta');
import { Generation } from "./generation.js";

export class GenerationContext {
	#queuedOperations;
	#debounceTimer;
	#head;
	#debounceTimeout = 750;

	// For now this property just tracks the latest generation, once I implement the logic for changing between generations, it will be handled with this property.
	#activeGeneration = null;

	set head(headOffset) {
		this.#head.offset = headOffset;
	}
	get head() {
		return this.#head.offset;
	}

	get length() {
		return this.#getActiveGenerationLength();
	}

	constructor(contextOffset, initialDelta) {
		this.#queuedOperations = [];
		// Head indicates the starting index in parent editor of the generation. This allows us to place updated generations on text changes prior to generation location.
		// This will have to be updated if the editor has changes above starting location of generation.
		this.#head = { offset: contextOffset };

		// On initial creation of a generation context, we create 2 initial generations, the first handles the first state (basically the full insert of text), 
		// the second is where any additional changes will be tracked.
		this.generations = this.buildGenerations(initialDelta, new Delta());
		this.#activeGeneration = 1;

	}

	buildGenerations(...deltas) {
		let generations = [];

		for (const delta of deltas) {
			generations.push(new Generation(delta, this.#head));
		}

		return generations;
	}

	// Takes deltas from editor and updates the latest generation.
	handleGenerationUpdate(op) {
		this.#queuedOperations.push(op);
		console.log("hit generation");

		// This will handle the logic to prevent the computation for merging operations into a generation from running immediately on every keypress.
		(function() {
			console.log("hit inner")
			clearTimeout(this.#debounceTimer);
			console.log("hit inner 2")

			this.#debounceTimer = setTimeout(() => {
				console.log("timed function");
				this.generations[this.#activeGeneration].mergeOps(this.#queuedOperations);
				this.#queuedOperations = [];
			}, this.#debounceTimeout);

			// this.#debounceTimer = null;
		}).apply(this);
	}

	#getActiveGenerationLength() {
		let length = 0;

		// TODO: This feels like a ton of nested loops, this just screams performance drain.
		for (const generation of this.generations) {
			for (const op of generation.delta.ops) {
				Object.keys(op).forEach(opType => {
					// NOTE: Retains don't change length, they are just pointers for reconstructing the content, so we don't need to track here.
					switch (opType) {
						case 'insert':
							length += op[opType].length;
							break;
						case 'delete':
							length -= op[opType];
							break;
					}
				});

			}
		}

		return length;
	}

}
