const Delta = Quill.import('delta');

function* chunks(arr, n) {
	for (let i = 0; i < arr.length; i += n) {
		yield arr.slice(i, i + n);
	}
}

export class Generation {
	#pointer = 0;
	#parentHeadOffset;

	// As I work through the activeGenerationContext cursor logic, I think that generations would not have the information needed to calculate the 
	// length meaningfully for the context.
	// -- This is due to the pointer never being used to go to the full content after the first generation in the context
	// TODO: refactor this to calculate length of delta
	get length() {
		// NOTE: as of 18 Aug 2025 this is no longer a valid way to get generation length 
		return this.#pointer;
	}

	constructor(delta = new Delta(), parentOffset) {
		// Private instance property
		this.delta = delta;
		this.#parentHeadOffset = parentOffset;

		this.debugOps = [];
	}

	mergeOps(ops) {
		console.log(ops)

		let buildDelta = new Delta();
		let runs = 0;
		for (let opPair of chunks(ops, 2)) {
			console.log(opPair[0].retain, this.#parentHeadOffset, runs++, opPair[1]);
		}

		this.#pointer = 0;
		// console.log(this.#parentHeadOffset.offset)
		// console.log("Ops", ops, this.#parentHeadOffset, this.delta)

		// This is reversed because we use compose, and composing from user input would reverse the text.
		// ops.forEach(op => {
		// 	if (typeof op.retain !== 'undefined') {
		// 		op.retain -= this.#parentHeadOffset.offset + this.#pointer;
		//
		// 		// This case catches retain 0 (meaning we are at current pointer), or retain -1 meaning we are about to delete.
		// 		if (op.retain <= 0) return;
		//
		// 		this.#pointer += op.retain;
		// 	}
		//
		// 	if (typeof op.insert !== 'undefined') {
		// 		this.#pointer += op.insert.length;
		// 	}
		//
		// 	if (typeof op.delete !== 'undefined') {
		// 		this.#pointer -= op.delete;
		// 	}
		//
		// 	this.delta = this.#mergeOpToDelta(op, this.delta);
		// });
		//
		console.log("this delta", this.delta)
		// this.delta = this.#mergeOpToDelta()
		// console.log("after delta", this.delta)
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

	#mergeOpToDelta(op, delta) {
		if (delta.ops.length > 0) {
			let lastOp = delta.ops[delta.ops.length - 1];

			if (lastOp) {
				if (typeof op.retain !== 'undefined') {
					if (typeof lastOp.retain !== 'undefined') {
						lastOp.retain += op.retain;
					} else {
						delta.ops.push(op);
					}
				}

				// TODO: The way this is formatted needs to be updated to support formats
				if (typeof op.insert !== 'undefined') {
					if (typeof lastOp.insert !== 'undefined') {
						console.log(lastOp)
						lastOp.insert = lastOp.insert + op.insert;
					} else {
						delta.ops.push(op);
					}
				}

				if (typeof op.delete !== 'undefined') {
					if (typeof lastOp.insert !== 'undefined') {
						lastOp.insert = lastOp.insert.slice(0, lastOp.insert.length - op.delete);
					} else if (typeof lastOp.delete !== 'undefined') {
						lastOp.delete += op.delete;
					} else {
						delta.ops.push(op);
					}
				}
			}
		} else {
			delta.ops.push(op);
		}

		return delta;
	}
}
