/* Backing store for the editor */

var slate0      = require('slate0');
var Selection   = slate0.Cursor;
var UndoManager = require('undomanager');
var model       = slate0.model;
var Operations  = slate0.Operations;

var EventEmitter = require('events').EventEmitter;

function Store(sharedoc, undoSteps) {
	var self = this;
	EventEmitter.call(this);

	this.sharedoc = sharedoc;
	this.ctx = sharedoc.createContext();
	this.ctx._onOp = function(op) { self.serverApply(op); };
	this.undoManager = new UndoManager(slate0.type, undoSteps || 400);
	this.selection = new Selection(0,0);

	this.middleWare = [];
}

Store.prototype = new EventEmitter();
Store.prototype.document = function() { return this.ctx.getSnapshot(); };
Store.prototype.apply = function(ops, selection, compose) {
	if (ops.toOp) ops = ops.toOp();
	this._apply(ops, selection);
	this.undoManager.add(ops, compose);
};
Store.prototype._applyMiddleWare = function() {
	var doc = this.ctx.getSnapshot();
	this.middleWare.forEach(function(f) {
		doc = f(doc);
	});
	this.sharedoc.snapshot = doc;
};
Store.prototype._apply = function(ops, selection) {
	if (ops.toOp) ops = ops.toOp();
	this.ctx.submitOp(ops);
	this.selection = selection ? selection : this.selection.transform(ops);
	this._applyMiddleWare();
	this.emit('change');
};
Store.prototype.select = function(selection) {
	// body...
	if (this.selection !== selection) {
		this.selection = selection;
		this.emit('change');
	}
};
Store.prototype.undo = function(index) {
	var me = this;
	if (!this.undoManager.canUndo()) return;
	this.undoManager.performUndo(function(err, op) {
		if (err) return;
		me._apply(op);
		me.undoManager.add(op);
	});
};
Store.prototype.redo = function(index) {
	var me = this;
	if (!this.undoManager.canRedo()) return;
	this.undoManager.performRedo(function(err, op) {
		if (err) return;
		me._apply(op);
		me.undoManager.add(op);
	});
};
Store.prototype.registerMiddleware = function(func) {
	this.middleWare.push(func);
	return this;
};
Store.prototype.serverApply = function(op) {
	this.undoManager.transform(op);
	this.selection = slate0.type.transformCursor(
		this.selection, op, false);
	this._applyMiddleWare();
	this.emit('change');
};
//TODO: this should be somewhere else..
Store.prototype.replaceSelection = function(elems, offset, compose, _sel) {
	var _offset = offset || 0;
	var _elems = elems || [];
	var sel = _sel === undefined ? this.selection : _sel;
	var st = sel.start() + _offset;
	var en = sel.end();
	var op = new Operations().retain(st);
	var lin = this.document().prefix(st,en, true);
	//TODO: make sure we are not causing unmatched tags
	//just keep track of them.
	lin.forEach(function(l) { op.remove(l); }); 
	_elems.forEach(function(l) { op.insert(l); });
	var cur = op.targetLength;
	op.end(this.document().length);
	sel = new Selection(cur, cur, sel.who);
	this.apply(op, sel, compose);
};

module.exports = Store;
