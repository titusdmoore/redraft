const Inline = Quill.import('blots/inline');

class GenerationBlot extends Inline {
	static blotName = "generation";
	static className = "generation";

	// TODO: currently if you click generation button without text selected, context handler doesn't see anything. These run no matter text selection, so I need to notify from here.
	static create(value) {
		const node = super.create();

		node.setAttribute("data-generation-id", value);
		console.log("ran here")

		return node;
	}

	static formats(node) {
		console.log("ran here the second")
		return node.dataset.generationId;
	}
}

Quill.register(GenerationBlot);
