
function Selection(anchor, focus, who) {
	this.anchor = anchor;
	this.focus  = focus;
	this.who = who || '';
}
Selection.prototype.isInverted = function() {
	return this.focus < this.anchor;
};
Selection.prototype.isCollapsed = function() {
	return this.focus === this.anchor;
};
Selection.prototype.transform = function(ops) {
	var newAnchor = transformIndex(this.anchor, ops);
	if (this.isCollapsed())
		return new Selection(newAnchor, newAnchor, this.who);
	return new Selection(newAnchor, transformIndex(this.focus, ops), this.who);
};
Selection.prototype.start = function() {
	return Math.min(this.anchor, this.focus);
};
Selection.prototype.end = function() {
	return Math.max(this.anchor, this.focus);
};

function transformIndex(_index, _ops) {
	var ops = _ops.ops;
	var index = _index;
	var newIndex = index;
	var l = ops.length;
	for (var i = 0; i < l; i++) {
		var op = ops[i];
		if (_ops.isRetain(op)) {
			index -= op.n;
		} else if (_ops.isInsert(op)) {
			newIndex += op.n;
		} else {
			//remove
			newIndex -= Math.min(index, op.n);
			index -= op.n;
		}
		if (index < 0) { break; }
	}
	return newIndex;
}

//TODO: represent a selection as multiple ranges not just one.

module.exports = Selection;