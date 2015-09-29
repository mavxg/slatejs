var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var render = require('../render');
var renderers = render.renderers;

var ot = require('ot-sexpr');
var List = ot.List;
var AttributedString = ot.AttributedString;
var sym = ot.sym;

var keyToId = require('../ids').keyToId;

var File = createClass({
	render: function() {
		var obj = this.props.obj;
		var editor = this.props.editor;
		var path = this.props.path ? this.props.path.slice(0) : [];
			path.push(obj.id);
		var props = {
			id: keyToId(obj.id),
			className: 'file',
			
		};
		//TODO render a dowload link and a form to change the file
		return DOM.div(props,"Click to Upload a File");
	}
});

renderers.file = File;

var keymap = [
	{keys:["ctrl+alt+f"], command:"insert_new_file", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
];

module.exports = function(editor) {

	editor.validDoc().section.file = true;

	var NEW_FILE = new List();
	NEW_FILE.push(sym('file'));

	function _insert_new_file(doc, region, args) {
		//insert new file
		var rows = args.rows || 2;
		var cols = args.columns || args.cols || 2;
		var attributes = args.attributes || {headerRows:1};

		var as = doc.attributesAt(region.begin());
		var breaks = [];
		var ops = [];
		var a;
		for (var i = as.length - 1; i >= 0; i--) {
			var x = as[i];
			breaks.push(x);
			ops.push(ot.
				operations.pop);
			if (x.type === 'list') break;
		};
		//insert new file here
		ops = ops.concat(NEW_FILE.prefix(0,NEW_FILE.size));
		//fixup
		while ((a = breaks.pop())) {
			if (a.type === 'list') {
				ops.push(ot.operations.pushA(a.attributes));
				ops.push(ot.operations.insert('p','sym')); //a.node.head().sym
			} else {
				ops.push(ot.operations.pushS());
			}
		}
		return doc.replace(region, ops);
	}
	function insert_new_file(args) {
		var doc = editor.document();
		var ops = [];
		editor.selection().regions.forEach(function(region) {
			var op = _insert_new_file(doc, region, args);
			var no = ot.transform(op,ops);
			ops = ot.compose(ops, no);
		});
		editor.apply(ops);
	}
	insert_new_file.description = function(args) {
		return "Insert new file";
	};

	return {
		commands: {
			insert_new_file: insert_new_file,
		},
		keymap: keymap,
		menu: [],
		context_menu: [],
	};	
};