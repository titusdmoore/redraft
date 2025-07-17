const Inline = Quill.import('blots/inline');

class GenerationBlot extends Inline {
	static blotName = "generation";
	static className = "generation";

	static create(value) {
		const node = super.create();

		node.setAttribute("data-generation-id", value);

		return node;
	}

	static formats(node) {
		return node.dataset.generationId;
	}
}

Quill.register(GenerationBlot);
