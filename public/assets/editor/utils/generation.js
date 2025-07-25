const Delta = Quill.import('delta');

export class Generation {
	#pointer = 0;

	set delta(delta) {
		delta
	}
	set appendDelta(op) {
		// this.delta.
	}

	get length() {
		// NOTE: I THINK this is valid, but in the future I may have to use the ops to calculate.
		return this.#pointer;
	}

	constructor(delta = new Delta()) {
		// Private instance property
		this.delta = delta;
	}


	mergeOps(ops) {
		for (const op of ops) {
			console.log("Merging Operations: ", op);
		}
	}
}
