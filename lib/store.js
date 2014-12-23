/* Backing store for the editor */

var Selection   = require('./selection');
var UndoManager = require('./undo');
var model       = require('./model');
var Operations  = require('./operations');

var EventEmitter = require('events').EventEmitter;

function Store(storageAdaptor, undoSteps) {
	EventEmitter.call(this);

	this.storageAdaptor = storageAdaptor;
	this.undoManager = new UndoManager(undoSteps || 400);

	this.clientDisconnect = this.clientDisconnect.bind(this);
    this.clientSelection  = this.clientSelection.bind(this);
    this.clientName       = this.clientName.bind(this);
    this.clients          = this.clients.bind(this);
    this.serverAck        = this.serverAck.bind(this);
    this.serverApply      = this.serverApply.bind(this);
    this.serverReconnect  = this.serverReconnect.bind(this);
	
	this.storageAdaptor.on('bye', this.clientDisconnect);
	this.storageAdaptor.on('reconnect', this.serverReconnect);
	this.storageAdaptor.on('ack', this.serverAck);
	this.storageAdaptor.on('apply', this.serverApply);
	this.storageAdaptor.on('clients', this.clients);
	this.storageAdaptor.on('name', this.clientName);
	this.storageAdaptor.on('selection', this.clientSelection);

	//TODO: document and initial selection
	// should come from the storageAdaptor.
	this.document = new model.Document(1,[]);
	this.selection = new Selection(0,0);
	this.revision = 0;

	this.clients = {};

	this.middleWare = [];
}
Store.prototype = new EventEmitter();
Store.prototype.apply = function(ops, selection, compose) {
	this._apply(ops, selection);
	this.undoManager.add(ops, compose);
};
Store.prototype._apply = function(ops, selection) {
	var doc = model.apply(this.document, ops);
	this.selection = selection ? selection : this.selection.transform(ops);
	if (doc !== this.document) {
		//for (var id in this.clients) {
		//	this.clients[id] = this.clients[id](ops);
		//}
		this.middleWare.forEach(function(f) {
			doc = f(doc);
		});
		this.document = doc;
		this.emit('change');
	}	
};
Store.prototype.select = function(selection) {
	// body...
	if (this.selection !== selection) {
		this.selection = selection;
		//this.storeAdaptor.sendSelection(selection);
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
Store.prototype.clientDisconnect = function(clientId) {
	// body...
};
Store.prototype.clientSelection = function(clientId, selection) {
	// body...
};
Store.prototype.clientName = function(clientId, name) {
	// body...
};
Store.prototype.clients = function(clients) {
	//TODO: set clients presence
};
Store.prototype.serverAck = function() {
	// body...
};
Store.prototype.serverApply = function(op) {
	this._apply(op);
	this.undoManager.transform(op);
};
Store.prototype.serverReconnect = function() {
	// body...
};

//actions
Store.prototype.newline = function() {
	//TODO:
	//Find the nesting in the document
	//make close tags
	//make attributes
	//make paragraph type (the newline)
	//make open tags
	//replace selection with those.

	//Note: very similar function for insert table/ or insert list etc.
};
Store.prototype.replaceSelection = function(elems, offset, compose, _sel) {
	var _offset = offset || 0;
	var _elems = elems || [];
	var sel = _sel === undefined ? this.selection : _sel;
	var st = sel.start() + _offset;
	var en = sel.end();
	var op = new Operations().retain(st);
	var lin = this.document.prefix(st,en, true);
	//TODO: make sure we are not causing unmatched tags
	//just keep track of them.
	lin.forEach(function(l) { op.remove(l); }); 
	_elems.forEach(function(l) { op.insert(l); });
	var cur = op.targetLength;
	op.end(this.document.length);
	sel = new Selection(cur, cur, sel.who);
	this.apply(op, sel, compose);
};

module.exports = Store;
