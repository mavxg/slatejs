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

    	//note decrypt is 
    	//var msg = openpgp.message.readArmored(armored);
    	//msg = msg.decrypt(privateKey);
    	//return msg.getText();

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
	var ret;
	for (var i = keys.length - 1; i >= 0; i--) {
		var key = keys[i];
		if (key.isPrivate()) {
			doDecryption = true;
			if (passphrase && !key.primaryKey.isDecrypted)
				key.decrypt(passphrase);
			ret = this.privateKeys[key.primaryKey.keyid.toHex()] = key;
			key = key.toPublic();
		}
		if (key)
			ret = this.publicKeys[key.primaryKey.keyid.toHex()] = key;
	};
	if (doDecryption) this._decryptSnapshot();
	return ret; //return the public key
};
EncryptedContext.prototype._decryptSnapshot = function() {
	//TODO
	console.log('_decryptSnapshot')
	console.log(this.privateKeys)
};
EncryptedContext.prototype.squash = function() {
	//TODO
	//traverse document and replace all the encrypted ops with
	//new nonce and squash to single op by composition
};

/*

//ops are retain from start of the encrypted area. If they contain
// a sequence number then you can apply them in sequence.

(encrypted (keys {id:..., key:...}) ...ops...)
 -- where each op is {r:rev, iv:..., op:encryptedop}

(encrypt (keys {}) ... objects created by ops ...)

 -- sqauash

*/

var Keys = createClass({
	render: function() {
		var children = this.props.keys.values.slice(1).map(function(k) {
				return Key({key:k});
			});
		children.unshift(DOM.h2({},this.props.title || "Keys"))
		return DOM.div({className:"content"},children);
	}
});

var Key = createClass({
	render: function() {
		var key = this.props.key;
		var id = key.id;
		var pub = openpgp.key.readArmored(key.public).keys[0];
		window.pub = pub;
		return DOM.div({},pub.getUserIds().map(function(u) { return DOM.p({},u); }));
	}
})

var Encrypted = createClass({
	handleEncrypt: function(e) {
		e.preventDefault();
		var editor = this.props.editor;
		var context = editor.store().context;
		if (!context.importKey) return;
		var form = this.form.node;
		var akey = form.key.value;
		var passphrase = form.passphrase.value;
		var pub = context.importKey(akey,passphrase);
		window.pub = pub;
		if (pub && !pub.isPrivate) {
			//generate aes secure key
			var aes = openpgp.crypto.random.getRandomBytes(32); //for aes256
			var apub = pub.armor();
			var keyid = pub.primaryKey.keyid.toHex()
			
			//pgp encrypt the aes key and store it on the document
			var msg = openpgp.message.fromText(aes);
    		msg = msg.encrypt([pub]);
    		var armored = openpgp.armor.encode(openpgp.enums.armor.message, 
    			msg.packets.write());
    		//TODO:
    		//insert (keys {id:keyid ,public:apub, key:armored})
    		//change to encrypt
    		//insert (p "")
		}
	},
	handleUnlock: function(e) {
		e.preventDefault();
		var editor = this.props.editor;
		var context = editor.store().context;
		if (!context.importKey) return;
		var form = this.form.node;
		var akey = form.key.value;
		var passphrase = form.passphrase.value;
		var pub = context.importKey(akey,passphrase);
		if (!pub) {
			this.setState({error:"Invalid key"});
		}
		return;
	},
	toggleUnlock: function() {
		this.setState({showUnlockForm:(!this.state.showUnlockForm)});
		e.preventDefault();
		e.stopPropagation();
	},
	render: function() {
		var obj = this.props.obj;
		var editor = this.props.editor;
		var props = {
			id: keyToId(obj.id),
			className: 'encrypted',
			
		};
		//wrap in form so the edtor recognises the clicks
		var toggle = DOM.form({},[DOM.a({href:'#',
				className:'icon_link', 
				onClick:this.toggleUnlock},[
				DOM.svg({className:'icon'},[
					DOM.use({'xlink:href':"sprite.svg#lock-locked"})
				])
			])]);

		var keys = obj.index(1);
		if (!keys) {
			this.form = DOM.form({
				onSubmit: this.handleEncrypt,
				className:"content pure-form pure-form-stacked",
				spellcheck: false,
			}, [
				DOM.h2({},"New Encrypted Section"),
				
				DOM.div({className:"pure-g"},[
					DOM.textarea({name:"key", className:"pure-u-1",placeholder:"PGP Private Key (Paste)", value:""})]),
				DOM.div({className:"pure-g"},[
					DOM.input({name:"passphrase", className:"pure-u-1",type:'password', placeholder:"Passphrase (Optional)", value:""})]),
				DOM.div({className:"pure-g"},[DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Encrypt")]),
			]);
			return DOM.div(props, [
				toggle,this.form]);
		} else {
			var inner = [toggle, Keys({keys:keys, title:'Encrypted By:'})]
			if (this.state.showUnlockForm) {
				this.form = this.form = DOM.form({
					onSubmit: this.handleEncrypt,
					className:"content pure-form pure-form-stacked",
					spellcheck: false,
				}, [
					DOM.h2({},"Unlock"),
					
					DOM.div({className:"pure-g"},[
						DOM.textarea({name:"key", className:"pure-u-1",placeholder:"PGP Private Key (Paste)", value:""})]),
					DOM.div({className:"pure-g"},[
						DOM.input({name:"passphrase", className:"pure-u-1",type:'password', placeholder:"Passphrase (Optional)", value:""})]),
					DOM.div({className:"pure-g"},[DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Unlock")]),
				]);
				inner.push(this.form);
			}
			return DOM.div(props, inner);
		}
		
	}
});

var Encrypt = createClass({
	toggleShare: function(e) {
		this.setState({showKeys:(!this.state.showKeys)});
		e.preventDefault();
		e.stopPropagation();
	},
	handleShare: function(e) {
		e.preventDefault(); //don't submit form
	},
	render: function() {
		var obj = this.props.obj;
		var editor = this.props.editor;
		var props = {
			id: keyToId(obj.id),
			className: 'encrypted',
			
		};
		var children = obj.tail();
		if (children.length === 0) children = ["\u00A0"];
		var toggle = DOM.form({},[DOM.a({href:'#',
				className:'icon_link', 
				onClick:this.toggleShare},[
				DOM.svg({className:'icon'},[
					DOM.use({'xlink:href':"sprite.svg#lock-unlocked"})
				])
			])]);
		this.shareForm = DOM.form({
			onSubmit: this.handleShare,
			className:"content pure-form pure-form-stacked shareForm",
			spellcheck: false}, [
				DOM.div({className:"pure-g"},[
					DOM.textarea({name:"key", className:"pure-u-1",placeholder:"Paste PGP Public Key to share", value:""}),
					DOM.button({type:'submit', className:"pure-button pure-button-primary"},"Share")
				])
			]);
		var inner = [toggle];
		if (this.state.showKeys) {
			inner.push(Keys({keys:obj.index(1), title:'Encrypted By:'}));
			inner.push(this.shareForm);
		}
		inner.push(DOM.div({className:"content"}, 
			renderChildren(children, this.props.selection, obj.id, editor)));
		return DOM.div(props,inner);
	}
});

//register renderers
renderers.encrypted = Encrypted;
renderers.encrypt = Encrypt;
// must be here and not in the plugin load as the plugin load is after
// first render

module.exports = function(editor) {
	//wrap context.
	var context = new EncryptedContext(editor.store().context);
	editor.store().context = context;

	
	function encrypt(args) {
		//args.id //id of node to be encrypted
		//args.privateKey
	}

	return {
	};
}
module.exports.openpgp = openpgp;
