/* Backing store for the editor */

var ottype      = require('ot-sexpr');
var ot          = ottype;
var Selection   = ottype.Selection;
var Region      = ottype.Region;
var UndoManager = require('undomanager');
var Operations  = ottype.operations;

var EventEmitter = require('events').EventEmitter;

function Store(context, undoSteps) {
	var self = this;
	EventEmitter.call(this);

	//this.sharedoc = sharedoc;
	//this.sharedoc.on('after op', function(op) { self.emit('change'); });
	this.context = context; //sharedoc.createContext();
	this.context._onOp = function(op) { self.serverApply(op); };
	this.undoManager = new UndoManager(ottype, undoSteps || 400);
	this.selection = new Selection();
}

Store.prototype = new EventEmitter();
Store.prototype.document = function() { return this.context.getSnapshot(); };
Store.prototype.apply = function(ops, selection, compose) {
	this.undoManager.add(ops, compose);
	this._apply(ops, selection);
};
Store.prototype.applyLocal = function(ops) {
	//TODO: this should really do something slightly different
	this.undoManager.add(ops, true);
	this._apply(ops);
};
Store.prototype.submitLocal = function() {
	//TODO: send local to the server
};
Store.prototype.submitOp = function(ops) {
	return this.context.submitOp(ops);
};
Store.prototype._apply = function(ops, selection) {
	this.submitOp(ops);
	this.selection = selection ? selection :
		ottype.transformCursor(this.selection, ops, true);
	this.emit('change');
	this.emit('apply',ops, true);
};
Store.prototype.select = function(selection) {
	// body...
	if (this.selection !== selection) {
		this.selection = selection;
		this.emit('change');
		this.emit('select', selection)
	}
};
Store.prototype.undo = function(index) {
	var me = this;
	if (!this.undoManager.canUndo()) return;
	this.undoManager.performUndo(function(err, op) {
		if (err) return;
		me.undoManager.add(op);
		me._apply(op);
	});
};
Store.prototype.redo = function(index) {
	var me = this;
	if (!this.undoManager.canRedo()) return;
	this.undoManager.performRedo(function(err, op) {
		if (err) return;
		me.undoManager.add(op);
		me._apply(op);
	});
};
Store.prototype.serverApply = function(op) {
	this.undoManager.transform(op);
	this.selection = ottype.transformCursor(
		this.selection, op, false);
	this.emit('change');
	this.emit('apply',op, false);
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
