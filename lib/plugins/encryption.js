/* Encryption plugin --- support encrypted sections of document */

var openpgp = require('openpgp');
var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var render = require('../render');
var renderChildren = render.renderChildren;
var renderers = render.renderers;

var keyToId = require('../ids').keyToId;

if (window && window.msCrypto) window.crypto = window.msCrypto;

function EncryptedContext(context) {
	var self = this;
	this.privateKeys = {};
	this.publicKeys = {};
	this.context = context;
	this._onOp = context._onOp;
	this.context._onOp = function(op) {
		//TODO: do something with the server op here
		if (self._onOp) self._onOp(op);
	}
}
EncryptedContext.prototype.getSnapshot = function() {
	//TODO make this a local decrypted snapshot.
	return this.context.getSnapshot();
};
EncryptedContext.prototype.submitOp = function(op) {
	//TODO: encrypt
	this.context.submitOp(op);
};
EncryptedContext.prototype.importKey = function(ascii, passphrase) {
	var keys = openpgp.key.readArmored(ascii).keys;
	var doDecryption = false;
	for (var i = keys.length - 1; i >= 0; i--) {
		var key = keys[i];
		if (key.isPrivate()) {
			doDecryption = true;
			if (passphrase && !key.primaryKey.isDecrypted)
				key.decrypt(passphrase);
			this.privateKeys[key.primaryKey.keyid.toHex()] = key;
			key = key.toPublic();
		}
		if (key)
			this.publicKeys[key.primaryKey.keyid.toHex()] = key;
	};
	if (doDecryption) this._decryptSnapshot();
};
EncryptedContext.prototype._decryptSnapshot = function() {
	//TODO
};
EncryptedContext.prototype.squash = function() {
	//TODO
	//traverse document and replace all the encrypted ops with
	//new nonce and squash to single op by composition
};

/*

TODO ... try this out without any operations first.

(encrypt (keys {id:..., sym:...} ...)
  (ops [nonce] ...op...)
  (ops [nonce] ...ops..))

ops should use negative/positive retain from its own location

//ops are retain from start of the encrypted area. If they contain
// a sequence number then you can apply them in sequence.

(encrypt (keys {id:..., key:...}) ...ops...)
 -- where each op is [nonce:op]

 -- sqauash

*/

var Encrypted = createClass({
	handleMouseDown: function(e) {
		console.log('Encrypted: handleMouseDown');

		e.stopPropagation();
	},
	render: function() {
		var obj = this.props.obj;
		var props = {
			id: keyToId(obj.id),
			className: 'encrypted',
			
		};
		var children = obj.tail(); 
		//TODO: if no keys render keyform
		if (children.length === 0) children = ["\u00A0"];
		return DOM.div(props, [
			DOM.svg({className:'icon'},[
				DOM.use({'xlink:href':"sprite.svg#lock-locked"})
			]),
			DOM.form({
				className:"content pure-form pure-form-stacked",
				onMouseDown: this.handleMouseDown,
				spellcheck: false,
			}, [
				DOM.h2({},"Encrypted Section"),
				
				DOM.div({className:"pure-g"},[
					DOM.textarea({className:"pure-u-1",placeholder:"PGP Private Key (Paste)", value:""})]),
				DOM.div({className:"pure-g"},[
					DOM.input({className:"pure-u-1",type:'password', placeholder:"Passphrase (Optional)", value:""})]),
				DOM.div({className:"pure-g"},[DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Encrypt")]),
			])]);
		//return DOM.div(props, renderChildren(children, this.props.selection, obj.id));
	}
});

//register renderers
renderers.encrypted = Encrypted; //TODO ideally would not be global
// must be here and not in the plugin load as the plugin load is after
// first render

module.exports = function(editor) {
	//wrap context.
	var context = new EncryptedContext(editor.store().context);
	editor.store().context = context;

	


	return {
	};
}
module.exports.openpgp = openpgp;
