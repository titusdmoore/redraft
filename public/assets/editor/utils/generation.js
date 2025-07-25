const Delta = Quill.import('delta');

export class Generation {
	#pointer = 0;
	#parentHeadOffset;

	// As I work through the activeGenerationContext cursor logic, I think that generations would not have the information needed to calculate the 
	// length meaningfully for the context.
	// -- This is due to the pointer never being used to go to the full content after the first generation in the context
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
		console.log("Buffered operations", ops);
		for (const op of ops) {
			for (const [key, value] of Object.entries(op)) {
				switch (key) {
					// NOTE: what does backpace do?
					case 'retain':
						let retainLength = this.#localOffset(value);

						// TODO: Test and resolve if needed bug
						// This logic may introduce a bug where retains that just so happen to be of len of pointer will be dropped.
						// This line is need to ensure we aren't adding duplicate retains that occur from editor.
						if ((retainLength - this.#pointer) == 0) continue;

						this.delta.ops.push({ retain: retainLength });
						this.#pointer = retainLength;
						break;

					case 'delete':
						// NOTE: this is just a brute implementation, I don't know the edge cases of delete yet.
						this.delta.ops.push({ delete: value });
						break;
					case 'insert':
						this.#pointer += value.length;

						let lastOp = this.#lastOp();
						if (lastOp !== null && Object.keys(lastOp).includes('insert')) {
							lastOp.insert = lastOp.insert.concat(value);
							continue;
						}

						this.delta.ops.push({ insert: value });
						break;
				}
			}
		}

		console.log("Completed merge: ", this)
	}

	#lastOp() {
		let lastOp = this.delta.ops[this.delta.ops.length - 1];
		if (lastOp) return lastOp;

		return null;
	}

	#localOffset(offset) {
		return offset - this.#parentHeadOffset.offset;
	}
}
