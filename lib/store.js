/* Backing store for the editor */

var Selection   = require('./selection');
var undo = require('./undo');

var EventEmitter = require('events').EventEmitter;

function Store(storageAdaptor) {
	EventEmitter.call(this);

	this.storageAdaptor = storageAdaptor;

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
	this.document = new model.Document(['\n']);
	this.selection = new Selection(1,1);
	this.revision = 0;

	this.clients = {};

	this.middleWare = [];
	//this.undoManager = new UndoManager();

}
Store.prototype = new EventEmitter();
Store.prototype.apply = function(ops) {
	var doc = apply(this.document, ops);
	if (doc !== this.document) {
		this.selection = this.seleciton.transform(ops);
		for (var id in this.clients) {
			this.clients[id] = this.clients[id](ops);
		}
		this.middleWare.forEach(function(f) {
			doc = f(doc);
		});
		this.document = doc;
		this.emit('change');
	}	
};
Store.prototype.emitChange = function(action) {
	if (this.onChange) this.onChange(action, this);
};
Store.prototype.select = function(selection) {
	// body...
	if (this.selection !== selection) {
		this.seleciton = selection;
		//this.storeAdaptor.sendSelection(selection);
		this.emit('change');
	}
	
};
Store.prototype.undo = function(index) {
	//TODO
	this.emit('change');
};
Store.prototype.redo = function(index) {
	// body...
	this.emit('change');
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
	// body...
};
Store.prototype.serverReconnect = function() {
	// body...
};


module.exports = Store;
