function Mark(attribute, options, type) {
	this.attribute = attribute;
	this.options = options;
	this.type = type;
}
function EndMark(attribute) {
	this.attribute = attribute;
}
function UnMark(attribute, options, type) {
	this.attribute = attribute;
	this.options = options;
	this.type = type;
}
function UnEndMark(attribute) {
	this.attribute = attribute;
}
function Retain(n) {
	this.n = n;
	this.inputLen = n;
}
function Skip(str) {
	this.str = str;
	this.inputLen = str.length;
}
function Insert(str) {
	this.str = str;
	this.length = str.length;
}

function Operation() {
	this.inputLen = 0;
}

Mark.prototype = new Operation();
EndMark.prototype = new Operation();
UnMark.prototype = new Operation();
UnEndMark.prototype = new Operation();
Retain.prototype = new Operation();
Skip.prototype = new Operation();
Insert.prototype = new Operation();

Mark.prototype.invert = function() {
	return new UnMark(this.attribute, this.options, this.type);
};
EndMark.prototype.invert = function() {
	return new UnEndMark(this.attribute);
};
UnMark.prototype.invert = function() {
	return new Mark(this.attribute, this.options, this.type);
};
UnEndMark.prototype.invert = function() {
	return new EndMark(this.attribute);
};
Retain.prototype.invert = function() {
	return this;
};
Skip.prototype.invert = function() {
	return new Insert(this.str);
};
Insert.prototype.invert = function() {
	return new Skip(this.str);
};

function Operations(ops) {
	this.ops = ops || [];
	this.inputLen = 0;
	for (var i = this.ops.length - 1; i >= 0; i--) {
		this.inputLen += this.ops[i].inputLen;
	};
}
Operations.prototype.push = function(op) { 
	this.inputLen += op.inputLen;
	this.ops.push(op);
};
Operations.prototype.retain = function(n) { 
	this.push(new Retain(n)); 
	return this;
};
Operations.prototype.skip = function(str) { 
	this.push(new Skip(str)); 
	return this;
};
Operations.prototype.end = function(doc) {
	if (doc.length >= this.inputLen) 
		this.retain(doc.length - this.inputLen + 1); 
	return this;
};
Operations.prototype.mark = function(attribute, options, type) { 
	this.push(new Mark(attribute, options, type)); 
	return this;
};
Operations.prototype.endmark = function(attribute) { 
	this.push(new EndMark(attribute)); 
	return this;
};
Operations.prototype.unmark = function(attribute, options, type) { 
	this.push(new UnMark(attribute, options, type)); 
	return this;
};
Operations.prototype.unendmark = function(attribute) { 
	this.push(new UnEndMark(attribute)); 
	return this;
};
Operations.prototype.insert = function(str) { 
	this.push(new Insert(str)); 
	return this;
};
Operations.prototype.invert = function() {
	return new Operations(this.ops.map(function(op) {
		return op.invert();
	}));
};
Operations.prototype.apply = function(doc) {
	return apply(doc, this.ops);
};
//left is if the data is from the client or server
// server sends back ops that should come before the
// op you sent so you can transform them
// with your ops (and the opposite left to the server).
Operations.prototype.transform = function(otherOps, left) {
	var newOps = new Operations();

	var ops = this.ops;

	var ia = 0;
	var io = 0;
	var offset = 0; //used in take
	var component;

	function take(n, indivisableField) {
		if (ia === ops.length)
			return n === -1 ? null : new Retain(n);

		var part;
		var c = ops[ia];
		if (c instanceof Retain) {
			if (n === -1 || c.n - offset <= n) {
				part = new Retain(c.n - offset);
				++ia;
				offset = 0;
				return part;
			} else {
				offset += n;
				return new Retain(n);
			}
		} else if (c instanceof Insert) {
			 if (n === -1 || indivisableField === 'i' || c.length - offset <= n) {
			 	part = new Insert(c.str.slice(offset));
			 	++ia;
			 	offset = 0;
			 	return part;
			 } else {
			 	part = new Insert(c.str.slice(offset, offset + n));
			 	offset += n;
			 	return part;
			 }
		} else if (c instanceof Skip) {
			if (n === -1 || indivisableField === 'd' || c.inputLen - offset <= n) {
				part = new Skip(c.str.slice(offset, offset + n));
				++ia;
				offset = 0;
				return part;
        	} else {
        		part = new Skip(c.str.slice(offset, offset + n));
			 	offset += n;
			 	return part;
			}
		} else {
			offset = 0;
			++ia;
			return c; //mark/endmark/unmark/unendmark
		}
	}

	var marks = {};
	var endMarks = {};
	var unMarks = {};
	var x;
	for (io = 0; io < otherOps.ops.length; io++) {
		var opo = otherOps.ops[io];
		var length, chunk;
		if (opo instanceof Retain) {
			length = opo.n;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				if (chunk instanceof Mark) {
					if (endMarks[chunk.attribute]) {
						newOps.push(chunk);
						delete endMarks[chunk.attribute];
					} else if ((x = marks[chunk.attribute])) {
						if ((x.options !== chunk.options || //TODO: object compare
							x.type !== chunk.type) && !left) {
							//Different and "~left" so they came first
							//meaning we need to end them
							//and put us in their place
							newOps.endmark(chunk.attribute);
							endMarks[chunk.attribute] = x;
							delete marks[chunk.attribute];
						} else {
							//same or "left" so we came first
							unMarks[chunk.attribute] = chunk;
						}
					} else {
						marks[chunk.attribute] = chunk;
						newOps.push(chunk);
					}
				} else if (chunk instanceof EndMark) {
					if (endMarks[chunk.attribute]) {
						delete endMarks[chunk.attribute];
					} else if (marks[chunk.attribute]) {
						newOps.push(chunk);
						delete marks[chunk.attribute];
					} else {
						newOps.push(chunk);
						endMarks[chunk.attribute] = true;
					}
					//NOTE: this is relying on cancelling
					//but is correct.
					if (unMarks[chunk.attribute]) {
						//put the other item back
						newOps.push(unMarks[chunk.attribute]);
						delete unMarks[chunk.attribute];
					}
				} else if (chunk instanceof UnMark) {
					newOps.push(chunk); //TODO
					unMarks[chunk.attribute] = chunk;
				} else if (chunk instanceof UnEndMark) {
					newOps.push(chunk); //TODO
				} else {
					newOps.push(chunk); //append(chunk);
				}
				length -= chunk.inputLen;
			}
		} else if (opo instanceof Insert) {
			if (left && ops[ia] instanceof Insert) {
				newOps.push(take(-1)); //left insert goes first;
			}
			newOps.retain(opo.length); //skip the inserted text
		} else if (opo instanceof Skip) {
			length = opo.inputLen;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				if (chunk instanceof Retain) {
					length -= chunk.n;
				} else if (chunk instanceof Insert) {
					newOps.push(chunk);
				} else if (chunk instanceof Skip) {
					length -= chunk.inputLen;
				} else if (chunk instanceof Mark) {
					if (endMarks[chunk.attribute]) {
						newOps.push(chunk);
						delete endMarks[chunk.attribute];
					} else if (unMarks[chunk.attribute]) {
						newOps.push(chunk);
						delete unMarks[chunk.attribute];
					} else {
						marks[chunk.attribute] = chunk;
						newOps.push(chunk);
					}
				} else if (chunk instanceof EndMark) {
					if (endMarks[chunk.attribute]) {
						delete endMarks[chunk.attribute];
					} else if (marks[chunk.attribute]) {
						newOps.push(chunk);
						delete marks[chunk.attribute];
					} else {
						newOps.push(chunk);
						endMarks[chunk.attribute] = chunk;
					}
					if (unMarks[chunk.attribute]) {
						//put the other item back
						newOps.push(unMarks[chunk.attribute]);
						delete unMarks[chunk.attribute];
					}
				} else if (chunk instanceof UnMark) {
					//TODO: probably need to check for marks
					newOps.push(chunk);
					unMarks[chunk.attribute] = chunk;
				} else if (chunk instanceof UnEndMark) {
					newOps.push(chunk); //TODO:
				}
			}
		} else if (opo instanceof Mark) {
			//TODO: this doesn't cover 
			// anywhere near all the orderings
			if ((x = marks[opo.attribute])) {
				if ((x.options !== opo.options || //TODO: object compare
					x.type !== opo.type) && left) {
					//Different and "left" so we came first
					//meaning we need to end ourselves
					//so the other stays in place
					newOps.endmark(opo.attribute);
					endMarks[opo.attribute] = x;
					delete marks[opo.attribute];
				} else {
					//same or "~left" so they came first
					//so we need to remove their mark
					//so our mark continues
					newOps.unmark(opo.attribute, opo.options, opo.type);
					unMarks[opo.attribute] = opo;
				}
			} else {
				marks[opo.attribute] = opo;
			}
		} else if (opo instanceof EndMark) {
			if (unMarks[opo.attribute]) {
				newOps.unendmark(opo.attribute);
				delete unMarks[opo.attribute];
			}
		} else if (opo instanceof UnMark) {
			//TODO
		} else if (opo instanceof UnEndMark) {
			//TODO
		}
	}

	while ((component = take(-1)))
		newOps.push(component);

	return newOps;
};
Operations.prototype.compose = function(other) {
	//TODO: implement
};

module.export = {
	Operations: Operations,
	Retain:     Retain,
	Mark:       Mark,
	UnMark:     UnMark,
	EndMark:    EndMark,
	UnEndMark:  UnEndMark,
	Skip:       Skip,
};