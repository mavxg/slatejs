import { renderComponent, createClass, DOM } from 'friar'
import { Editor, Document } from './editor'
import { parse, Selection, Region, apply, transformCursor } from 'ot-sexpr'

const base = require('./plugins/base');
const table = require('./plugins/table');


//Dummy Blockstore object
function BlockStore(dummy_cost) {
	this.store = {};
	this.dummy_cost = dummy_cost || 300;  //simulate 300ms to save/load block
};
BlockStore.prototype.get = function(key, callback) {
	var thus = this;
	setTimeout(function() {
		callback(key, thus.store[key])
	}, this.dummy_cost);
};
BlockStore.prototype.put = function(key, block, callback) {
	this.store[key] = block;
	setTimeout(function() {
		if (callback) callback(key);
	}, this.dummy_cost);
};


//This is not quite what we need..
// as the put is not going to know the key
// we need to do something different.
function ObjStore(blockstore, deserialise, serialise) {
	this.cache = {}; //blocks parsed
	this.deserialise = deserialise;
	this.serialise = serialise;
	this.blockstore = blockstore;
}
ObjStore.prototype.get = function(key, callback) {
	var obj = this.cache[key];
	if (obj) return callback(key, obj);
	var thus = this;
	this.blockstore.get(key, function(key, block) {
		//note this might not be enough... we need to have context to derive key
		// to decrypt the block.
		var obj = thus.deserialise(key, block);
		this.cache[key] = obj;
		callback(key, obj);
	});
};
ObjStore.prototype.put = function(key, object, ) {
	//TODO: this doesn't quite work.
};


//Dummy Table/Tree object.
function Table(objstore, root_block) {
	this.changes = {};
	this.subscriptions = {};
	this.all_subscription = [];
	this.objstore = objstore;
	this.root_block = root_block;
	this._pending = {}; //blocks being fetched.
};
Table.prototype.fetch = function(key, callback) {
	//Trigger fetch of a key not in cache
	// not needed for the dummy store.
	// override for block backed stuff...
};
Table.prototype.get = function(key, callback) {
	var value = this.changes[key];
	if (value != undefined) callback(key, value);
	else this.fetch(key, callback);
};
Table.prototype.notify = function(key, value, old) {
	var subs = this.subscriptions[key];
	if (subs) for (var i = subs.length - 1; i >= 0; i--) {
		try {
			var f = subs[i];
			f(key, value, old)
		} catch (e) {
			subs.splice(i,1) //remove subscriber on throw
		}
	}
	subs = this.all_subscription;
	for (var i = subs.length - 1; i >= 0; i--) {
		try {
			var f = subs[i];
			f(key, value, old)
		} catch (e) {
			subs.splice(i,1) //remove subscriber on throw
		}
	}
};
Table.prototype.set = function(key, value) {
	var old = this.cache[key];
	//Notify subscribers
	this.notify(key, value, old);
};
Table.prototype.subscribe = function(key, callback) {
	var subs = this.subscriptions[key];
	if (!(subs)) {
		subs = this.subscriptions[key] = [];
	}
	subs.push(callback);
	//NOTE: subscribe doesn't do a get
	// and fetch doesn't notify subscribers.
};
Table.prototype.unsubscribe = function(key, callback) {
	var subs = this.subscriptions[key];
	if (!subs) return;
	var i = subs.indexOf(callback);
	if (i > -1) subs.splice(i, 1); //remove item
};
Table.prototype.subscribeAll = function(callback) {
	this.all_subscription.push(callback);
};
Table.prototype.unsubscribeAll = function(callback) {
	var subs = this.all_subscription;
	var i = subs.indexOf(callback);
	if (i > -1) subs.splice(i, 1); //remove item
};

//Note: Displayed table object should actually be pivot powered from the start.
// all of the columns should be based upon id .. entries in cells are
// all of the form {#ida:id, #idb:id, content: ... }
// we then index that when we actually go to render the table.
// any table size and in out can be afforded.
// don't build the calculation tables we have elsewhere.
// IO tables are just underspecified.

// List items should be dummied up with paragraph items rather than trying to wrap them
// Code items should not merge together unless they are in the same code block


// FaaS - functions defined in blocks that you can then call upon... 
// output of object should be storable (or cacheable).

const doc = `(doc (section
(p "")
{"headerRows":1}(table
(row (cell "Cat[]=") (cell "Qube[]") (cell "Other[]") (cell "Extra"))
(row (cell "First") (cell "99") (cell "100") (cell))
(row (cell "Second") (cell "199") (cell "200") (cell))
(row (cell "Third") (cell "299") (cell "300") (cell))
)
(h1 "Welcome to SlateJS")
(p "Welcome to your editor.")
(p [[76,{}],[2,{"sub":true}],[24,{}],[2,{"sup":true}],[76,{}],[16,{"href":"http://google.co.uk"}],[177,{}]]"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, aliquid ex necessitatibus repellatTM a illo fuga dolore aperiam totam tempore nisi neque delectus labore, nihil quae dignissimos dolores mollitia? Vel sunt neque voluptatibus excepturi laboriosam possimus adipisci quidem dolores, omnis nemo dolore eligendi blanditiis, voluptatem in doloribus hic aperiam.")
{"alignments":["left","right"]}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(p "")
{"alignments":["left","right"]}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(p "")
) (section
(h1 "Another Section")
(p "Another paragraph in a another section")
(code "Another = Qube * Other + 5")
(code "Extra[Cat=First] = 77")
(code "Extra = 88")
(code "Test[Cat=First] = 123456")
(code "Another[Cat=First]")
(code "Qube[Cat=First]")
(ulli "First list item")
{"indent":2}(ulli "First sub list item")
{"indent":3}(ulli "First sub sub list item")
(ulli "Second list item")
{"indent":2}(ulli "First sub list item")
{"indent":2}(ulli "Second sub list item")
(olli "First list item")
{"indent":2}(olli "First sub list item")
{"indent":2}(olli "Second sub list item")
(olli "Second list item")
(blockquote "This is a really important quote.")
(pullquote "This is another really important quote.")
{"alignments":["left","right"], "headerRows":1}(table
(row (cell "Some text to go in the cell") (cell "Header2"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after.") {"rowSpan":2}(cell "99"))
(row (cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
(row {"colSpan":2}(cell [[29,{}],[28,{"strong":true}],[17,{"strong":true,"em":true}],[20,{"em":true}]]"Text this is not bold before Some bold text to go in the bold italic cell. and not bold after."))
)
(result (p "paragraph in a result"))
(p "")
))`

const sel = new Selection([new Region(12,9)]);

//Example of how to make a document undo manager plugin
var undoer = (editor) => {
	function undo() {
		console.log('Would love to undo right now.');
	}
	undo.description = () => "Undo previous action.";

	function redo() {
		console.log('Would love to redo right now.')
	}
	redo.description = () => "Redo previous action.";

	return {
		commands: {
			undo,
			redo,
		},
		keymap: [
			{keys:["ctrl+z"], command:"undo"},
			{keys:["cmd+z"], command:"undo"},
			{keys:["ctrl+shift+z"], command:"redo"},
			{keys:["cmd+y"], command:"redo"},
		]
	}
}

var App = createClass({
	getInitialState: function() {
		var state = {
			document: parse(this.props.doc)[0],
			selection: sel
		};
		return state;
	},
	apply: function(ops, selection, compose) {
		var doc = apply(this.state.document, ops);
		var sel = selection ? selection :
			transformCursor(this.state.selection, ops, true)
		this.setState({
			document: doc, 
			selection: sel
		});
		//TODO: this.undoManager.add(ops, compose);
	},
	select: function(selection) {
		if (this.state.selection !== selection)
			this.setState({selection: selection});
	},
	render: function() {
		var s = this.state;
		return Editor({
			document: s.document,
			apply: this.apply,
			select: this.select,
			selection: s.selection,
			plugins:[undoer, base, table]
		});
	}
});

//Why do the plugins need to have access to the editor?
//They need to provide commands and a set of keymaps

renderComponent(App({doc}),document.getElementById('app'));