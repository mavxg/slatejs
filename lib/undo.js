
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
	var op = operation.invert();
	if (this.state === UNDOING) {
		this.redoStack.push(op);
		this.dontCompose = true;
	} else if (this.state === REDOING) {
		this.undoStack.push(op);
		this.dontCompose = true;
	} else {
		//normal state
		if (!this.dontCompose && compose && this.undoStack.length > 0) {
			this.undoStack.push(op.compose(this.undoStack.pop()));
		} else {
			this.undoStack.push(op);
			if (this.undoStack.length > this.maxItems) { this.undoStack.shift(); }
		}
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
	fn(null, this.undoStack.pop());
	this.state = NORMAL;
};
UndoManager.prototype.performRedo = function(fn) {
	this.state = REDOING;
	if (this.redoStack.length === 0) fn("Redo stack empty");
	fn(null, this.redoStack.pop());
	this.state = NORMAL;
};
UndoManager.prototype.canUndo = function() {
	return this.undoStack.length > 0;
};
UndoManager.prototype.canRedo = function() {
	return this.redoStack.length > 0;
};

function transform(ops, other) {
	return ops.map(function(op) { return op.transform(other); });
}

module.exports = UndoManager;