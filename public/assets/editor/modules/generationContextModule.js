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
	#trackingInitial

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
		window.debugGenerationContexts = this._generationContexts;


		this.quill.on('text-change', this.handleTextChange.bind(this));
		this.quill.on('selection-change', this.handleCursorInput.bind(this));
		this.quill.on('generation-change', this.handleGenerationChange.bind(this));
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
				let generationContext = this._generationContexts[this.activeGenerationContext];
				let retainedContent = this.quill.getContents(pointer, newDelta.retain);

				// Sanity Check
				console.assert(generationContext !== undefined, "Unexpected Generation Context selected, unable to add changes to generation.");
				if (generationContext === undefined) return;

				generationContext.handleGenerationUpdate(newDelta);
				return;
			}

			// What are the ways we hit this is how do we need to handle?
			// - We select a segment of text inside a single block - handle by creating a generation, and add the start and end - SHOULD BE DONE
			// - We've selected a segment of text that spans multiple blocks - create a generation, on subsequent runs of the parent closure we will have the same generation id
			// 	this allows us to just add an additional block to blocks arr - SHOULD BE DONE - I think this also answers a question above about the generation struct
			// - We've selected partial of a generation block text and click generation - Prompt user to remove generation or create new.
			if (Object.keys(newDelta).includes("attributes") && Object.keys(newDelta.attributes).includes("generation")) {
				let retainedContent = this.quill.getContents(pointer, newDelta.retain);

				const generationId = newDelta.attributes.generation;
				if (!(generationId in this._generationContexts)) {
					this._generationContexts[newDelta.attributes.generation] = new GenerationContext(pointer, retainedContent);

					// Generations have been updated, handle UI updates
					this.updateGenerationsUI();
				} else {
					// This code shouldn't work for the next generation but it should work for the first generation.
					this._generationContexts[newDelta.attributes.generation].generations[0].delta.ops.push(...retainedContent.ops);
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
			if (generationContext.head <= range.index && range.index <= (generationContext.head + generationContext.length)) {
				console.log("Inside of a generation", generationContextId, generationContext)
				this.activeGenerationContext = generationContextId;
				return;
			}
		}

		this.activeGenerationContext = null;
	}

	handleGenerationChange(generationContext, generation) {
		console.log("Hello, I am handling a change for generation", generationContext, generation);
		let context = this._generationContexts[generationContext];
		let initialLength = context.length;
		let content = context.setActiveGeneration(generation);
		console.log("Settings", initialLength, content, context.head)
		console.log("delete check", this.quill.getContents(context.head, initialLength));
		this.quill.deleteText(context.head, initialLength, 'silent');
		let buildDelta = new Delta([{ retain: context.head }]);
		console.log("retain", buildDelta)
		console.log("retain check", this.quill.getContents(0, context.head));
		buildDelta = buildDelta.concat(content)
		buildDelta = buildDelta.retain(this.quill.getLength() - buildDelta.length);
		console.log("Check final", buildDelta)
		this.quill.updateContents(buildDelta, 'silent');
	}

	updateGenerationsUI() {
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
}

Quill.register('modules/generationContextTracker', GenerationContextTracker);
