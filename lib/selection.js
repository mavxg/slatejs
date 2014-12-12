
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
	//TODO:
	return this;
};
Selection.prototype.start = function() {
	return Math.min(this.anchor, this.focus);
};
Selection.prototype.end = function() {
	return Math.max(this.anchor, this.focus);
};

module.exports = Selection;