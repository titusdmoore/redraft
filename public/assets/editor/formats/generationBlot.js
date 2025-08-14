const Inline = Quill.import('blots/inline');

class GenerationBlot extends Inline {
	static blotName = "generation";
	static className = "generation";

	// TODO: currently if you click generation button without text selected, context handler doesn't see anything. These run no matter text selection, so I need to notify from here.
	// Props contain id and quill
	static create({ id, emitCallback }) {
		const node = super.create();

		node.setAttribute("data-generation-id", id);

		if (emitCallback && id) {
			emitCallback.emit('add-generation', id);
		}

		return node;
	}

	static formats(node) {
		return node.dataset.generationId;
	}
}

Quill.register(GenerationBlot);
