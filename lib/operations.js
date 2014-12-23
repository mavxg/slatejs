//Document considered to be

// ["text",{object taking up one character},"more text", etc]

// ... This works except for range based things like bold, link, comment
// etc. Especially if you can have an overlapping range of things.
// --- actually it works for those so long as the individual clients
// --- didn't try to delete half a pair.

function Retain(n) {
	this.n = n;
	this.inputLen = n;
	this.targetLength = n;
}
function Remove(str_or_obj) {
	this.str = str_or_obj;
	this.n = (typeof str_or_obj === 'string') ? str_or_obj.length : 1;
	this.inputLen = this.n;
	this.targetLength = 0;
}
function Insert(str_or_obj) {
	this.str = str_or_obj;
	this.n = (typeof str_or_obj === 'string') ? str_or_obj.length : 1;
	this.inputLen = 0;
	this.targetLength = this.n;
}

Retain.prototype.invert = function() { return this; };
Remove.prototype.invert = function() { return new Insert(this.str); };
Insert.prototype.invert = function() { return new Remove(this.str); };


Retain.prototype.slice = function(s, e) {
	var real_end = (e === undefined ? this.n : e);
	var ret = new Retain(real_end - s);
	return ret;
};
Remove.prototype.slice = function(s, e) {
	if (typeof this.str === 'string')
		return new Remove(this.str.slice(s, e));
	return this;
};
Insert.prototype.slice = function(s, e) {
	if (typeof this.str === 'string')
		return new Insert(this.str.slice(s, e));
	return this;
};

function _invert(op) { return op.invert(); }

function Operations(ops) {
	this.ops = ops || [];
	this.inputLen = 0;
	this.targetLength = 0;
	for (var i = this.ops.length - 1; i >= 0; i--) {
		this.inputLen += this.ops[i].inputLen;
		this.targetLength += this.ops[i].targetLength;
	};
}

function _type(op) {
	if (op instanceof Retain) return 'retain';
	if (op instanceof Remove && typeof op.str === 'string') return 'remove';
	if (op instanceof Insert && typeof op.str === 'string') return 'insert';
	return 'object';
}

Operations.prototype.push = function(op) { 
	this.inputLen += op.inputLen;
	this.targetLength += op.targetLength;
	if (this.ops.length > 0) {
		var nt = _type(op);
		var ot = _type(this.ops[this.ops.length - 1]);
		if (nt === ot && nt !== 'object') {
			var oop = this.ops.pop();
			switch(nt) {
				case 'retain':
					op = new Retain(op.n + oop.n);
					break;
				case 'remove':
					op = new Remove(oop.str + op.str);
					break;
				case 'insert':
					op = new Insert(oop.str + op.str);
					break;
			}
		}
	}
	this.ops.push(op);
};
Operations.prototype.pushs = function(ops) {
	ops.forEach(this.push, this);
};
Operations.prototype.retain = function(n) { 
	this.push(new Retain(n)); 
	return this;
};
Operations.prototype.remove = function(str) { 
	this.push(new Remove(str)); 
	return this;
};
Operations.prototype.insert = function(str) { 
	this.push(new Insert(str)); 
	return this;
};
Operations.prototype.end = function(len) { 
	this.push(new Retain(len - this.inputLen)); 
	return this;
};
Operations.prototype.invert = function() {
	return new Operations(this.ops.map(_invert));
};

function makeTake(ops) {
	var offset = 0;
	var ia = 0;

	function take(n, indivisableField) {
		if (ia === ops.length)
			return n === -1 ? null : new Retain(n);

		var part;
		var c = ops[ia];
		if (n === -1 || c.n - offset <= n ||
		   ((c instanceof Insert) && indivisableField === 'i') ||
		   ((c instanceof Remove) && indivisableField === 'd')) {
			part = c.slice(offset);
			++ia;
			offset = 0;
			return part;
		} else {
			part = c.slice(offset, offset + n);
			offset += n;
			return part;
		}
	}

	function peek() {
		return ops[ia];
	}

	return {
		take: take,
		peek: peek,
	};
		
}

//left is if the data is from the client or server
// server sends back ops that should come before the
// op you sent so you can transform them
// with your ops (and the opposite left to the server).
Operations.prototype.transform = function(otherOps, left) {
	var newOps = new Operations();

	var chunk;
	var length;
	var opo;

	var tp = makeTake(this.ops);
	var take = tp.take;
	var peek = tp.peek;
	
	for (var i = 0; i < otherOps.ops.length; i++) {
		opo = otherOps.ops[i];
		if (opo instanceof Retain) {
			length = opo.n;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				newOps.push(chunk); //append(chunk);
				length -= chunk.inputLen;
			}
		} else if (opo instanceof Insert) {
			if (left && peek() instanceof Insert) {
				newOps.push(take(-1)); //left insert goes first;
			}
			newOps.retain(opo.n); //skip the inserted text
		} else if (opo instanceof Remove) {
			length = opo.inputLen;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				if (chunk instanceof Retain) {
					length -= chunk.n;
				} else if (chunk instanceof Insert) {
					newOps.push(chunk);
				} else if (chunk instanceof Remove) {
					length -= chunk.inputLen;
				}
			}
		}
	}

	while ((chunk = take(-1)))
		newOps.push(chunk);

	return newOps;
};
Operations.prototype.compose = function(other) {
	var newOps = new Operations();

	var chunk;
	var length;
	var opo;

	var tp = makeTake(this.ops);
	var take = tp.take;
	var peek = tp.peek;
	
	for (var i = 0; i < other.ops.length; i++) {
		opo = other.ops[i];
		if (opo instanceof Retain) {
			length = opo.n;
			while (length > 0) {
				chunk = take(length, 'd'); // don't split delete
				newOps.push(chunk); //append(chunk);
				length -= chunk.targetLength;
			}
		} else if (opo instanceof Insert) {
			newOps.push(opo)
		} else if (opo instanceof Remove) {
			length = opo.inputLen;
			var s = 0;
			while (length > 0) {
				chunk = take(length, 'd'); // don't split insert
				if (chunk instanceof Retain) {
					//append part of the delete...
					newOps.push(opo.slice(s, s + chunk.n));
					length -= chunk.n;
					s += chunk.n;
				} else if (chunk instanceof Insert) {
					length -= chunk.n;
					s += chunk.n;
				} else if (chunk instanceof Remove) {
					newOps.push(chunk);
				}
			}
		}
	}

	while ((chunk = take(-1)))
		newOps.push(chunk);

	return newOps;
};

Operations.isRetain = function(op) { return (op instanceof Retain); };
Operations.isRemove = function(op) { return (op instanceof Remove); };
Operations.isInsert = function(op) { return (op instanceof Insert); };

Operations.prototype.isRetain = Operations.isRetain;
Operations.prototype.isRemove = Operations.isRemove;
Operations.prototype.isInsert = Operations.isInsert;

module.exports = Operations;