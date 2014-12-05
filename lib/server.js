var EventEmitter = require('events').EventEmitter;

//Dummy ServerAdaptor
function NonServerAdaptor() {
	EventEmitter.call(this);
}
NonServerAdaptor.prototype = new EventEmitter();
NonServerAdaptor.prototype.select = function(selection) {};
NonServerAdaptor.prototype.apply = function(revision, operation, selection) {
	setTimeout(function() { this.emit('ack'); },1); //pretend ack after 1ms.
};

module.exports = {
	NonServerAdaptor: NonServerAdaptor,
};