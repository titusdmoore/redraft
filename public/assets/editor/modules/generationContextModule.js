import { GenerationContext } from "../utils/generationContext.js";
const Module = Quill.import('core/module');

// The generation module is how we keep track of a documents generations. 
// A singular generation needs the following information
// 	- Generation Id
// 	- Start and end index
// 	- Content or delta information to be able to build information for a generation.
//
//	TODO figure out what happens when a generation is created, is the text removed, just highlight with an option to create a revision?
// 	TODO figure out how overlapped generations would work
// 	TODO figure out what happens when the text a generation covers has been deleted
// 	TODO figure out how to update generation index
// 		- What if we register and event on input or change text, then mutate indexes by length of changes?
class GenerationContextTracker extends Module {
	constructor(quill, options) {
		super();

		this.quill = quill;
		this.options = options;

		// Just a proof of concept of potentially storing generations in class
		// I think we may want to store the delta. We would have an insert representing the first generation, with subsequent deltas.
		// Potential issues: What happens when someone starts editing outside of the delta that impacts delta text? How do we tie into editor deltas?
		// Active used to keep track of which generation an author is looking at?
		// Rough structure { intGenerationId: [{ deltas: [deltaArr], blocks: [ [intStart, endEnd], active: bool ]}] }
		// ^^ Just thinking, do I need lookups by generationId? Would an array be better?
		// NOTE: I believe the above has been overriden by the generation util.
		this.generationContexts = {};
		this.activeGenerationContext = null;

		// NOTE: this is a temp var while I refactor the logic in this module
		this._generationContexts = {};


		this.quill.on('text-change', this.handleTextChange.bind(this));
		this.quill.on('selection-change', this.handleCursorInput.bind(this));
	}

	handleTextChange(delta, oldDelta, source) {
		console.log("Logged from generation handler: ", delta, oldDelta, source);
		// Following is what I believe is a valid assumption where as long as the new delta has generation objects, we need to add tracking for it.
		let pointer = 0;

		// This compute runs for every input I think, which isn't ideal
		delta.forEach((newDelta, _index) => {
			// Handle delta when cursor is inside a generation.
			// This will handle tracking deltas for a specific generation.
			if (this.activeGenerationContext !== null) {
				let generation = this.generationContexts[this.activeGenerationContext];
				let generationContext = this._generationContexts[this.activeGenerationContext];
				let retainedContent = this.quill.getContents(pointer, newDelta.retain);

				// Sanity Check
				console.assert(generation !== undefined, "Unexpected Generation selected, unable to add changes to generation.");
				if (generation === undefined) return;

				console.log("I am a further delta", newDelta, retainedContent, generation);
				generationContext.handleGenerationUpdate(newDelta);
				// I believe this should be moved to a debounced handler, maybe I need a full module meant to parse text to delta. TBD

				if (generation.deltas.length <= 1) {
					generation.deltas.push({ ops: [] });
				}

				for (const [opKey, opValue] of Object.entries(newDelta)) {
					// console.log("This message should only run once.", opKey, opValue);
					let lastOp = generation.deltas[1].ops[generation.deltas[1].ops.length - 1];
					switch (opKey) {
						case "retain":
							// Every text entry will come in as a retain and an insert, we don't wan't duplicate retains. 
							// This logic is temporary until I can figure out a better solution.
							// console.log("retain exists", generation.deltas[1].ops.some(el => (Object.keys(el).includes("retain") && el.retain === opValue - generation.blocks[0][0])))
							if (generation.deltas[1].ops.some(el => (Object.keys(el).includes("retain") && el.retain === opValue - generation.blocks[0][0]))) continue;

							generation.deltas[1].ops.push({ retain: opValue - generation.blocks[0][0] });
							break;
						case "delete":
							generation.deltas[1].ops.push(newDelta);
							break;
						case "insert":
							if (lastOp && Object.keys(lastOp).includes("insert")) {
								lastOp.insert.push(newDelta.insert);
								continue;
							}

							generation.deltas[1].ops.push(newDelta);
							break;
					}
				}
			}

			// What are the ways we hit this is how do we need to handle?
			// - We select a segment of text inside a single block - handle by creating a generation, and add the start and end - SHOULD BE DONE
			// - We've selected a segment of text that spans multiple blocks - create a generation, on subsequent runs of the parent closure we will have the same generation id
			// 	this allows us to just add an additional block to blocks arr - SHOULD BE DONE - I think this also answers a question above about the generation struct
			// - We've selected partial of a generation block text and click generation - Prompt user to remove generation or create new.
			if (Object.keys(newDelta).includes("attributes") && Object.keys(newDelta.attributes).includes("generation")) {
				// console.log("what's included?", newDelta)
				let retainedContent = this.quill.getContents(pointer, newDelta.retain);
				// Handle 
				// console.log("Active?", this.activeGenerationContext)
				// console.log("Retain delta", retainContent);

				const generationId = newDelta.attributes.generation;
				if (!(generationId in this.generationContexts)) {
					this.generationContexts[newDelta.attributes.generation] = { deltas: [retainedContent], blocks: [[pointer, pointer + newDelta.retain]] };
					this._generationContexts[newDelta.attributes.generation] = new GenerationContext(pointer, this.quill.getContents(pointer, newDelta.retain));
					console.log("Generation Context: ", this._generationContexts);

					// Generations have been updated, handle UI updates
					this.updateGenerationsUI();
				} else {
					this.generationContexts[newDelta.attributes.generation].blocks.push([pointer, pointer + newDelta.retain]);

					// This code shouldn't work for the next generation but it should work for the first generation.
					this.generationContexts[newDelta.attributes.generation].deltas[0].ops.push(...retainedContent.ops);
				}
			}

			pointer += newDelta.retain;
		});

		// console.log(this.generationContexts);
		// console.log(this.quill.getContents());
	}

	// This function handles where the cursor is. This allows me to check when users are clicking or selecting a generation area.
	handleCursorInput(range, oldRange, source) {
		// Prevent error on inital page load.
		if (range === null) return;

		console.log("This is a cursor event", range, oldRange, source, this.generationContexts);
		for (const [generationId, generation] of Object.entries(this.generationContexts)) {
			if (generation.blocks[0][0] < range.index && range.index < generation.blocks[generation.blocks.length - 1][1]) {
				console.log("Inside of a generation", generationId, generation)
				this.activeGenerationContext = generationId;
				return;
			}
		}

		this.activeGenerationContext = null;
	}

	updateGenerationsUI() {
		const generationsParentElement = document.querySelector("#generations");

		// Error Guard
		if (generationsParentElement === null) return;

		// Prevent duplicate nodes being added to parent
		generationsParentElement.innerHTML = "";

		console.log(this.generationContexts)
		for (const [generationId, generation] of Object.entries(this.generationContexts)) {
			console.log("Hello, Generation", generationId, generation)
			// Create Generation Card
			let el = document.createElement("div");
			el.classList.add("generation-card--container");
			el.id = `generationCard${generationId}`;
			el.textContent = `generationCard${generationId}`;

			generationsParentElement.appendChild(el);
		}
	}
}

Quill.register('modules/generationContextTracker', GenerationContextTracker);
