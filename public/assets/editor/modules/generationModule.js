const Delta = Quill.import('delta');

// The generation module is how we keep track of a documents generations. 
// A singular generation needs the following information
// 	- Generation Id
// 	- Start and end index
// 	- Content or delta information to be able to build information for a generation.
//
// 	TODO figure out how overlapped generations would work
// 	TODO figure out what happens when the text a generation covers has been deleted
// 	TODO figure out how to update generation index
// 		- What if we register and event on input or change text, then mutate indexes by length of changes?
class GenerationTracker {
	constructor(quill, options) {
		this.quill = quill;
		this.options = options;

		// Just a proof of concept of potentially storing generations in class
		// I think we may want to store the delta. We would have an insert representing the first generation, with subsequent deltas.
		// Potential issues: What happens when someone starts editing outside of the delta that impacts delta text? How do we tie into editor deltas?
		// Active used to keep track of which generation an author is looking at?
		// Rough structure { intGenerationId: [{ delta: {}, blocks: [ [intStart, endEnd], active: bool ]}] }
		// ^^ Just thinking, do I need lookups by generationId? Would an array be better?
		this.generations = {};
		this.activeGeneration = null;


		this.quill.on('text-change', this.handleTextChange.bind(this));
		this.quill.on('selection-change', this.handleCursorInput.bind(this));
	}

	handleTextChange(delta, oldDelta, source) {
		console.log("Logged from generation handler: ", delta, oldDelta, source);
		// Following is what I believe is a valid assumption where as long as the new delta has generation objects, we need to add tracking for it.
		let pointer = 0;

		// This compute runs for every input I think, which isn't ideal
		delta.forEach((newDelta, _index) => {
			// What are the ways we hit this is how do we need to handle?
			// - We select a segment of text inside a single block - handle by creating a generation, and add the start and end - SHOULD BE DONE
			// - We've selected a segment of text that spans multiple blocks - create a generation, on subsequent runs of the parent closure we will have the same generation id
			// 	this allows us to just add an additional block to blocks arr - SHOULD BE DONE - I think this also answers a question above about the generation struct
			// - We've selected partial of a generation block text and click generation - Prompt user to remove generation or create new.
			if (Object.keys(newDelta).includes("attributes") && Object.keys(newDelta.attributes).includes("generation")) {
				const generationId = newDelta.attributes.generation;
				if (!(generationId in this.generations)) {
					// I THINK here we want to create a delta that contains an insert for the first generation, if empty may have to place newline per quill docs
					this.generations[newDelta.attributes.generation] = { blocks: [[pointer, pointer + newDelta.retain]] };
				} else {
					this.generations[newDelta.attributes.generation].blocks.push([pointer, pointer + newDelta.retain]);
				}
			}

			console.log("Checking retaining", pointer, newDelta.retain);
			pointer += newDelta.retain;
		});

		console.log(this.generations);
		console.log(this.quill.getContents());
	}

	// This function handles where the cursor is. This allows me to check when users are clicking or selecting a generation area.
	handleCursorInput(range, oldRange, source) {
		console.log("This is a cursor event", range, oldRange, source, this.generations);
		for (const [generationId, generation] of Object.entries(this.generations)) {
			if (generation.blocks[0][0] < range.index && range.index < generation.blocks[generation.blocks.length - 1][1]) {
				console.log("Inside of a generation", generationId, generation)
			}
		}
	}
}

Quill.register('modules/generationTracker', GenerationTracker);
