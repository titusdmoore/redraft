const Inline = Quill.import('blots/inline');

class LinkBlot extends Inline {
	static blotName = 'link';
	static tagName = 'a';

	static create(value) {
		const node = super.create();

		node.setAttribute("href", value);
		node.setAttribute("target", "_blank");

		return node;
	}

	static formats(node) {
		return node.getAttribute('href');
	}
}

Quill.register(LinkBlot);
