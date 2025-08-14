const Delta = Quill.import('delta');

export class Generation {
	#pointer = 0;
	#parentHeadOffset;

	// As I work through the activeGenerationContext cursor logic, I think that generations would not have the information needed to calculate the 
	// length meaningfully for the context.
	// -- This is due to the pointer never being used to go to the full content after the first generation in the context
	// TODO: refactor this to calculate length of delta
	get length() {
		// NOTE: I THINK this is valid, but in the future I may have to use the ops to calculate.
		return this.#pointer;
	}

	constructor(delta = new Delta(), parentOffset) {
		// Private instance property
		this.delta = delta;
		this.#parentHeadOffset = parentOffset;
	}

	mergeOps(ops) {
		console.log("Buffered operations", ops, "reversed", ops.reverse());
		let buildDelta = new Delta();
		let delCount = 0;
		ops.reverse().forEach(op => {
			if (typeof op.delete === "number") {
				delCount += op.delete;
			}

			if (typeof op.retain === "number") {
				// TODO: this is extremely computationally heavy (tons of loops hidden or not) so I need to figure out a better way to resolve this
				// The reason it is like this is because to get the correct retain on second text insert you need to find the offset in editor, offset from current building delta, and the offset from the parent generation delta length.
				op.retain -= this.#parentHeadOffset.offset + Generation.getRawDeltaLength(buildDelta) + Generation.getRawDeltaLength(this.delta);

				if (op.retain <= 0 || op.retain === buildDelta.length() - delCount) {
					return;
				}
			}

			buildDelta = buildDelta.concat(new Delta([op]));
		});
		console.log("is this delta", this.delta)
		this.delta = this.delta.concat(buildDelta);

		console.log("Completed merge: ", this)
	}

	static getRawDeltaLength(delta) {
		let length = 0;

		delta.forEach(op => {
			if (typeof op.delete !== "undefined") return;

			// console.log(op)

			if (typeof op.retain === "number") length += op.retain;
			if (typeof op.insert === "string") length += op.insert.length;
		});

		return length;
	}
}
