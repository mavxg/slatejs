/* Encryption plugin --- support encrypted sections of document */

var openpgp = require('openpgp');
var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var render = require('../render');
var renderChildren = render.renderChildren;
var renderers = render.renderers;

var ot = require('ot-sexpr');
var List = ot.List;
var AttributedString = ot.AttributedString;
var sym = ot.sym;
var Selection = ot.Selection;
var Region = ot.Region;

var keyToId = require('../ids').keyToId;

if (window && window.msCrypto) window.crypto = window.msCrypto;

function EncryptedContext(context, editor) {
	var self = this;
	this.editor = editor;
	this.privateKeys = {};
	this.defaultKey;
	this.publicKeys = {};
	this.aesKeys = {}; //node id to string key
	this.aesEnc = {}; //node id to ...
	//region to encrypt key...
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
			if (key && !this.defaultKey)
				this.defaultKey = key;
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

var NEW_P = (function() {
	var npl = new List();
	npl.push(sym('p'));
	npl.push(new AttributedString(""));
	return npl.prefix(0,npl.size);
})();

function new_encrypt_key(context, editor, pub, node) {
	editor.document().parent = null; //ensure parent null
	//generate aes secure key
	var aes = openpgp.crypto.random.getRandomBytes(32); //for aes256
	var apub = pub.armor();
	var keyid = pub.primaryKey.keyid.toHex()
	
	//pgp encrypt the aes key and store it on the document
	var msg = openpgp.message.fromText(aes);
    msg = msg.encrypt([pub]);
    var armored = openpgp.armor.encode(openpgp.enums.armor.message, 
    	msg.packets.write());
    //add key to encrypted region
    var new_keys = new List();
    new_keys.push(sym('keys'));
    new_keys.push({id:keyid ,public:apub, key:armored});
    var offset = node.offset();
    if (offset === -1)
    	throw "Cannot find node offet to encrypt.";
    //TODO: register node with context
    var ops = node.prefix(1,2,ot.operations.delete);
    ops.unshift(ot.operations.retain(offset + 1));
    ops.push(ot.operations.insert('encrypt','sym'));
    ops = ops.concat(new_keys.prefix(0,new_keys.size));
    ops = ops.concat(NEW_P);
    var selection = new Selection([new Region(offset + 2 + new_keys.size + 3)]);
    editor.apply(ops, selection);
    editor.ensureFocus();
    editor.scrollToCursor();
}

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
		if (pub && !(pub.isPrivate()))
			new_encrypt_key(context, editor, pub, this.props.obj);
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

var keymap = [
	{keys:["ctrl+i","e"], command:"insert_new_encrypted", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["cmd+i","e"], command:"insert_new_encrypted", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
];

module.exports = function(editor) {
	//wrap context.
	var context = new EncryptedContext(editor.store().context, editor);
	editor.store().context = context;

	//(doc -> region -> (arg) -> op) -> selection -> ops
	function bySelection(f, selection, arg) {
		var doc = editor.document();
		var ops = [];
		var _selection = selection || editor.selection();
		function _replace(region) {
			var op = f(doc, region, arg);
			ops = ot.compose(ops, ot.transform(op,ops));
		}
		_selection.forEachR(_replace);
		return ops;
	}

	//this is the same as section break but with
	//the ability to insert things between the
	//sections
	function _insert_new(doc, region, between) {
		var as = doc.attributesAt(region.begin());
		var breaks = [];
		var ops = [];
		var a;
		for (var i = as.length - 1; i >= 0; i--) {
			var x = as[i];
			breaks.push(x);
			ops.push(ot.operations.pop);
			if (x.type === 'list' && x.node.head().sym === 'section') break;
		};
		if (x.node.head().sym !== 'section') return []; //could not find section to break;
		ops = ops.concat(between);
		while ((a = breaks.pop())) {
			if (a.type === 'list') {
				ops.push(ot.operations.pushA(a.attributes));
				ops.push(ot.operations.insert(a.node.head().sym,'sym'));
			} else {
				ops.push(ot.operations.pushS());
			}
		}
		return doc.replace(region, ops);
	}

	var NEW_ENC = new List();
	NEW_ENC.push(sym('encrypted'));

	function insert_new(args) {
		var between = NEW_ENC.prefix(0,NEW_ENC.size);
		var sel = editor.selection();
		if (sel.regions.length !== 1) return;
		var region = sel.regions[0];
		var doc = editor.document();
		var ops = _insert_new(doc, region, between);
		editor.apply(ops);
		//if we have a key decrypt the region
		var context = editor.store().context;
		console.log('Default key')
		console.log(context.defaultKey)
		if (context.defaultKey !== undefined) {
			var off = 0;
			for (var i = 0; i < ops.length; i++) {
				var op = ops[i];
				if (op.op === 'insert' &&
					op.type === 'sym' &&
					op.value === 'encrypted')
					break;
				switch (op.op) {
					case 'retain':
					case 'insert':
						off += op.n;
						break;
				}
			};
			var node = editor.document().nodeAt(off-1).node;
			console.log(off)
			console.log(node)
			if (!(node && node instanceof List &&
				node.head().sym === 'encrypted' &&
				node.values.length === 1)) return;
			new_encrypt_key(context, editor, context.defaultKey, node);
		}
	}
	insert_new.description = function(args) {
		return "Insert new encrypted section."
	};

	return {
		commands: {
			insert_new_encrypted: insert_new,
		},
		keymap: keymap,
	};
}
module.exports.openpgp = openpgp;
