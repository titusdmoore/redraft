import { GenerationContext } from "../utils/generationContext.js";
const Module = Quill.import('core/module');
const Delta = Quill.import('delta');

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
	#trackingInitial;
	#cursorDescendentContexts;

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
		this.#cursorDescendentContexts = [];

		// NOTE: this is a temp var while I refactor the logic in this module
		this._generationContexts = {};
		window.debugGenerationContexts = this._generationContexts;


		this.quill.on('text-change', this.handleTextChange.bind(this));
		this.quill.on('selection-change', this.handleCursorInput.bind(this));
		this.quill.on('generation-change', this.handleGenerationChange.bind(this));
		this.quill.on('add-generation', this.handleAddGeneration.bind(this));
	}

	// This function currently is only used to handle adding a generation from inside a generation context without having a selection (so just a cursor).
	handleAddGeneration(...data) {
		// TODO: This is duplicated logic from ~24 lines down in handleTextChange, refactor to prevent duplicated code.
		if (this.activeGenerationContext !== null) {
			let generationContext = this._generationContexts[this.activeGenerationContext];

			generationContext.addGeneration();
			this.updateGenerationsUI();
		}
	}

	handleTextChange(delta, oldDelta, source) {
		// Following is what I believe is a valid assumption where as long as the new delta has generation objects, we need to add tracking for it.
		let pointer = 0;

		this.#notifyDescendentContexts(delta);

		// This compute runs for every input I think, which isn't ideal
		let handlingNewGenerationContext = null;
		delta.forEach((newDelta, _index) => {
			// Handle delta when cursor is inside a generation.
			// This will handle tracking deltas for a specific generation.
			if (this.activeGenerationContext !== null) {
				let generationContext = this._generationContexts[this.activeGenerationContext];

				// Sanity Check
				console.assert(generationContext !== undefined, "Unexpected Generation Context selected, unable to add changes to generation.");
				if (generationContext === undefined) return;

				// Handle user creating generation inside of existing context
				console.log("Handling generation click inside of active, ", newDelta);
				if (typeof newDelta.retain !== "undefined" && typeof newDelta.attributes?.generation !== "undefined") {
					generationContext.addGeneration();
					this.updateGenerationsUI();
					return;
				}

				generationContext.handleGenerationUpdate(newDelta);
				return;
			}

			// What are the ways we hit this is how do we need to handle?
			// - We select a segment of text inside a single block - handle by creating a generation, and add the start and end - SHOULD BE DONE
			// - We've selected a segment of text that spans multiple blocks - create a generation, on subsequent runs of the parent closure we will have the same generation id
			// 	this allows us to just add an additional block to blocks arr - SHOULD BE DONE - I think this also answers a question above about the generation struct
			// - We've selected partial of a generation block text and click generation - Prompt user to remove generation or create new.
			if ((Object.keys(newDelta).includes("attributes") && Object.keys(newDelta.attributes).includes("generation")) || handlingNewGenerationContext !== null) {
				let retainedContent = this.quill.getContents(pointer, newDelta.retain);

				const generationId = newDelta?.attributes?.generation ?? handlingNewGenerationContext;
				if (!(generationId in this._generationContexts)) {
					this._generationContexts[generationId] = new GenerationContext(pointer, retainedContent);
					handlingNewGenerationContext = newDelta.attributes.generation;

					// Generations have been updated, handle UI updates
					this.updateGenerationsUI();
				} else {
					// This code shouldn't work for the next generation but it should work for the first generation.
					this._generationContexts[generationId].generations[0].delta.ops.push(...retainedContent.ops);
				}
			}

			pointer += newDelta.retain;
		});
	}

	// This function handles where the cursor is. This allows me to check when users are clicking or selecting a generation area.
	handleCursorInput(range, oldRange, source) {
		// Prevent error on inital page load.
		if (range === null) return;

		console.log("This is a cursor event", range, oldRange, source, this._generationContexts);
		for (const [generationContextId, generationContext] of Object.entries(this._generationContexts)) {
			// Add any generation contexts after cursor to effect to update if text changes to keep track of heads
			if (range.index < generationContext.head) {
				this.#cursorDescendentContexts.push(generationContextId);
			}

			console.log("Hit here, this is just a great time")
			if (generationContext.head <= range.index && range.index <= (generationContext.head + generationContext.length)) {
				console.log("Inside of a generation", generationContextId, generationContext)
				this.activeGenerationContext = generationContextId;
				return;
			}
		}

		this.activeGenerationContext = null;
	}

	handleGenerationChange(generationContext, generation) {
		let context = this._generationContexts[generationContext];
		let initialLength = context.length;

		context.setActiveGeneration(generation);
		let finalDelta = new Delta([{ retain: context.head }]);
		let buildDelta = new Delta();
		for (let genIter = 0; genIter <= generation; genIter++) {
			buildDelta = buildDelta.compose(context.generations[genIter].delta);
		}

		finalDelta = finalDelta.concat(buildDelta);

		this.quill.deleteText(context.head, initialLength, 'silent');

		this.quill.updateContents(finalDelta, 'silent');
	}

	#notifyDescendentContexts(delta) {
		let headDelta = this.#calculateHeadChange(delta);

		this.#cursorDescendentContexts.forEach(id => {
			let context = this._generationContexts[id];
			context.head = context.head + headDelta;
		});
	}

	#calculateHeadChange(delta) {
		let change = 0;

		delta.forEach(op => {
			if (typeof op.insert === "string") change += op.insert.length;
			if (typeof op.delete === "number") change += op.delete;
		});

		return change;
	}

	updateGenerationsUI() {
		console.log("Handling UI Updates");
		const generationsParentElement = document.querySelector("#generations");

		// Error Guard
		if (generationsParentElement === null) return;

		// Prevent duplicate nodes being added to parent
		generationsParentElement.innerHTML = "";

		for (const [generationContextId, generationContext] of Object.entries(this._generationContexts)) {
			console.log("Generation Context", generationContextId, generationContext)
			// Create Generation Card
			let el = document.createElement("div");
			el.classList.add("generation-card--container");

			if (generationContextId === this.activeGenerationContext) {
				el.classList.add("active");
			}

			el.id = `generationContextCard${generationContextId}`;
			el.style.margin = '0  1rem 1rem';
			el.style.border = '1px solid green';

			let heading = document.createElement("h2");
			heading.innerText = `Generation context ${generationContextId}`;
			el.appendChild(heading);

			let ul = document.createElement('ul');
			let genIndex = 0;
			for (const generation of generationContext.generations) {
				let li = document.createElement('li');
				li.setAttribute('data-generation-context', generationContextId);
				li.setAttribute('data-generation', genIndex);
				li.addEventListener('click', (e) => {
					this.quill.emitter.emit('generation-change', e.target.dataset.generationContext, e.target.dataset.generation);
				});
				li.innerText = `Generation ${genIndex++}`;
				ul.appendChild(li);
			}

			el.appendChild(ul);
			generationsParentElement.appendChild(el);
		}
	}

	rawDeltaLength(delta) {
		let length = 0;

		delta.forEach(op => {
			if (typeof op.delete !== "undefined") return;

			if (typeof op.retain === "number") length += op.retain;
			if (typeof op.insert === "string") length += op.insert.length;
		});

		return length;
	}
}

Quill.register('modules/generationContextTracker', GenerationContextTracker);
