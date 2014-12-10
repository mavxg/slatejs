
var NORMAL = 'normal';
var UNDOING = 'undoing';
var REDOING = 'redoing';

function UndoManager(maxItems) {
	this.state = NORMAL;
	this.maxItems = maxItems || 200;
	this.dontCompose = false;
	this.undoStack = [];
	this.redoStack = [];
}
UndoManager.prototype.add = function(operation, compose) {
	if (this.state === UNDOING) {

	} else if (this.state === REDOING) {

	} else {
		//normal state
		//TODO: write compose so we can do the compose step.
		//if (!this.dontCompose && compose && this.undoStack.length > 0) {
		//	this.undoStack.push(operation.compose(this.undoStack.pop()));
		//} else {
			this.undoStack.push(operation);
			if (this.undoStack.length > this.maxItems) { this.undoStack.shift(); }
		//}
		this.dontCompose = false;
		this.redoStack = []; //IDEA, can we save the redo stack from destruction?
	}
};
UndoManager.prototype.transform = function(op) {
	this.undoStack = transform(this.undoStack, op);
	this.redoStack = transform(this.redoStack, op);
};
UndoManager.prototype.performUndo = function(fn) {
	this.state = UNDOING;
	if (this.undoStack.length === 0) fn("Undo stack empty");
	fn(null, this.undoStack.pop().invert());
	this.state = NORMAL;
};
UndoManager.prototype.performRedo = function(fn) {
	this.state = REDOING;
	if (this.redoStack.length === 0) fn("Redo stack empty");
	fn(null, this.redoStack.pop().invert());
	this.state = NORMAL;
};
UndoManager.prototype.canUndo = function() {
	return this.undoStack.length > 0;
};
UndoManager.prototype.canRedo = function() {
	return this.redoStack.length > 0;
};
//TODO: do we really need these?
UndoManager.prototype.isUndoing = function() {
	return this.state === UNDOING;
};
UndoManager.prototype.isRedoing = function() {
	return this.state === REDOING;
};

function transform(ops, other) {
	return ops.map(function(op) { return op.transform(other); });
}

module.exports = UndoManager;