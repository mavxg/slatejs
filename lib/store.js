/* Backing store for the editor */

var ottype      = require('ot-sexpr');
var ot          = ottype;
var Selection   = ottype.Selection;
var UndoManager = require('undomanager');
var Operations  = ottype.operations;

var EventEmitter = require('events').EventEmitter;

function Store(sharedoc, undoSteps) {
	var self = this;
	EventEmitter.call(this);

	this.sharedoc = sharedoc;
	this.ctx = sharedoc.createContext();
	this.ctx._onOp = function(op) { self.serverApply(op); };
	this.undoManager = new UndoManager(ottype, undoSteps || 400);
	this.selection = new Selection();

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
	this.selection = selection ? selection : ottype.transformCursor(this.selection, ops);
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
	this.selection = ottype.transformCursor(
		this.selection, op, false);
	this._applyMiddleWare();
	this.emit('change');
};

Store.prototype.replaceText = function(selection, offset, str, attributes, compose) {
	var doc = this.document();
	var sel = selection || this.selection;
	var off = offset || 0;
	sel = new Selection(sel.regions.map(function(r) { return new Region(r.begin() + off, r.end()); }));
	var ops = [];
		function _replace(region) {
			var op;
			if (region.empty())
				op = doc.insertText(region.focus, str, attributes);
			else
				op = doc.replaceText(region, str, attributes);
			ops = ot.compose(ops, ot.transform(op,ops));
		}
	sel.forEachR(_replace);
	this.apply(ops,null,compose);
};

module.exports = Store;
