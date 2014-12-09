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
	var real_end = e === undefined ? this.n : e;
	return new Retain(real_end - s);
};
Remove.prototype.slice = function(s, e) {
	if (typeof this.str === 'string')
		return new Remove(this.str.slice(s, e));
	return this;
};
Insert.prototype.slice = function(s, e) {
	if (typeof o.str === 'string')
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
Operations.prototype.push = function(op) { 
	this.inputLen += op.inputLen;
	this.targetLength += op.targetLength;
	this.ops.push(op);
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
Operations.prototype.invert = function() {
	return new Operations(this.ops.map(_invert));
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
	var chunk;
	var length;
	var opo;

	var offset = 0; //used in take
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

	for (io = 0; io < otherOps.ops.length; io++) {
		opo = otherOps.ops[io];
		if (opo instanceof Retain) {
			length = opo.n;
			while (length > 0) {
				chunk = take(length, 'i'); // don't split insert
				newOps.push(chunk); //append(chunk);
				length -= chunk.inputLen;
			}
		} else if (opo instanceof Insert) {
			if (left && ops[ia] instanceof Insert) {
				newOps.push(take(-1)); //left insert goes first;
			}
			newOps.retain(opo.length); //skip the inserted text
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
	//TODO: implement
};

Operations.isRetain = function(op) { return (op instanceof Retain); };
Operations.isRemove = function(op) { return (op instanceof Remove); };
Operations.isInsert = function(op) { return (op instanceof Insert); };

Operations.prototype.isRetain = Operations.isRetain;
Operations.prototype.isRemove = Operations.isRemove;
Operations.prototype.isInsert = Operations.isInsert;

module.exports = Operations;