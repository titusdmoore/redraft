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

		// This will handle the logic to prevent the computation for merging operations into a generation from running immediately on every keypress.
		(function() {
			clearTimeout(this.#debounceTimer);

			this.#debounceTimer = setTimeout(() => {
				this.generations[this.#activeGeneration].mergeOps(this.#queuedOperations);
				this.#queuedOperations = [];
			}, this.#debounceTimeout);

			// this.#debounceTimer = null;
		}).apply(this);
	}


	buildContentForGeneration(generationIndex) {
		// This may need to throw
		if (generationIndex >= this.generations.length) return;

		let ops = [];

		for (let iter = 0; iter <= this.#activeGeneration; iter++) {
			console.log("Ran iter")
			ops.push(...this.generations[iter].delta.ops);
		}

		return new Delta(ops);
	}

	buildContentForActiveGeneration() {
		return this.buildContentForGeneration(this.#activeGeneration);
	}

	addGeneration() {
		this.generations.push(new Generation(new Delta(), this.#head));
		this.#activeGeneration = this.generations.length - 1;
	}

	setActiveGeneration(generation) {
		this.#activeGeneration = generation;
	}

	#getActiveGenerationLength() {
		let lenDelta = new Delta();
		for (let genIter = 0; genIter <= this.#activeGeneration; genIter++) {

			if (lenDelta.length() === 0) {
				lenDelta = lenDelta.concat(this.generations[genIter].delta);
				continue;
			}

			lenDelta = lenDelta.compose(this.generations[genIter].delta);
		}

		console.log("From generation length, ", lenDelta, lenDelta.length(), this.head)
		return lenDelta.length();
	}

}
