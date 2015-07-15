
var ot = require('ot-sexpr');
var sym = ot.sym;

var Selection = ot.Selection;
var Region = ot.Region;
var Visitor = ot.Visitor;

function commands(editor) {

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
	
	function undo() { editor.undo(); }
	undo.description = function() { return "Undo previous action."; };

	function redo() { editor.redo(); }
	redo.description = function() { return "Redo previous undo."; };

	function format(args) {
		var type = args.type;
		var selection = editor.selection();
		var regions = selection.regions;
		var region = regions[regions.length - 1];
		var doc = editor.document()
		if (!region) {
			//set insert attributes
			return;
		}
		var attrs = doc.attributesAt(region.focus) || [];
		var lattrs = attrs[attrs.length -1];
		var attributes = {};
		var unattributes = {};
		if (lattrs.type === 'string' && lattrs.attributes[type])
			unattributes[type] = true;
		else
			attributes[type] = true;
		var ops = bySelection(function(doc, region) {
			return doc.reattribute(region, attributes, unattributes, 'text');
		}, selection);
		editor.apply(ops);
	}
	format.description = function(args) {
		return "Format selected text.";
	};
	
	function link(args) {
		//if args.href do the link
		// else make links show a placeholder if no args...
		//TODO show link dialog. (don't use modal.. put a placeholder in the document)
		console.log("link");
	}
	link.description = function() {
		return "Create link for selected text.";
	};

	function _style(doc, region, args) {
		var remove = args.remove;
		var head = args.style || "p";
		var b = region.begin();
		var e = region.end();
		var v = new Visitor(doc);
		var n;
		//retain to start
		while((n=v.next()) && v.point <= e) {
			if (n.type === 'list' &&
				n.head().can_restyle &&
				(v.point + n.size) >= b)
				break;
		}
		//replace heads
		n = v.next(); //go to the symbol
		while (n && v.point <= e) {
			if (n.type === 'symbol' && n.can_restyle) {
				n = v.replace(head, 'sym');
				if (remove && n.type === 'string' &&
					n.str.slice(0, remove.length) === remove) {
					v.retain(1); //retiain the start of the string
					v.deleteChars(remove);
				}
			}
			else
				n = v.next();
		}
		return v.ops;
	};

	function style(args) {
		var ops = bySelection(_style, null, args);
		editor.apply(ops);
	}
	style.description = function(args) {
		return "Apply " + args.style + " style.";
	};

	function attribute(args) {
		//
	}
	attribute.description = function(args) {
		return "Apply paragraph attributes."
	};

	function indent() {
		console.log("indent");
	}
	indent.description = function() {
		return "Indent selected paragraphs."
	};

	function unindent() {
		console.log("unindent");
	}
	unindent.description = function() {
		return "Unindent selected paragraphs."
	};

	//movement commands
	function move(args) {
		var by = args.by || 'characters'; 
		//by in characters, words,
		// word_ends, subword, subword_ends,
		// lines, wholelines, pages
		var amount = args.amount || 1; //number
		var forward = args.forward;
		if (forward === undefined) forward = true;
		var extend = args.extend; //should extend selection
		var selection = editor.selection();
		var regions = selection.regions;

		//TODO
		console.log("Move: " + JSON.stringify(args));

		var ns = new Selection();

		regions.forEach(function(r) {
			ns = ns.add(editor.move(r, by, amount, forward, extend))
		});

		editor.select(ns);
	}

	var numberWords = {
		1:"one",
		2:"two",
	};

	var moveDescriptions = {
		characters: "character",
		words: "word",
		word_ends: "word end",
		subwords: "subword", //includes Uppercase and _
		subword_ends: "subword end",
		lines: "line",
		wholelines: "whole line",
		pages: "page",
	};

	move.description = function(args) {
		var amount = args.amount || 1; 
		var direction = args.forward ? "forward" : "backward";
		var mode = (moveDescriptions[args.by] || "character") +
					(amount > 1 ? "s" : "");
		var amountWord = numberWords[amount] || amount;
		var extend = args.extend ? "Extend" : "Move";

		return extend + " selection " +
			direction + " " +
			amountWord + " " +
			mode + ".";
	};

	function moveTo(args) {
		console.log("MoveTo: " + JSON.stringify(args));
		var position = args.position; //eol, bol, hardeol, hardbol, eof, bof
		var extend = args.extend; //should extend selection
		var selection = editor.selection();
		var regions = selection.regions;

		var ns = new Selection();

		regions.forEach(function(r) {
			ns = ns.add(editor.moveTo(r, position, extend))
		});

		editor.select(ns);
	};

	var moveToDescriptions = {
		eol: "end of line",
		bol: "beginning of line",
		hardeol: "hard end of line",
		hardbol: "hard beginning of line",
		bof: "beginning of file",
		eof: "end of file",
	};
	moveTo.description = function(args) {
		var position = moveToDescriptions[args.position] || "unknown position";
		var extend = args.extend ? "Extend" : "Move";
		return extend + " selection to " + position + ".";
	};

	function _delete(args) {
		var by = args.by || 'characters';
		var amount = args.amount || 1; //number
		var forward = args.forward;
		if (forward === undefined) forward = true;
		var ops = bySelection(function(doc, region) {
			var r = editor.move(region, by, amount, forward, true);
			return doc.eraseText(r);
		});
		editor.apply(ops);
	}
	_delete.description = function(args) {
		var amount = args.amount || 1;
		var direction = args.forward ? "forward" : "backward";
		var mode = (moveDescriptions[args.by] || "character") +
					(amount > 1 ? "s" : "");
		var amountWord = numberWords[amount] || amount;

		return "Delete " +
			direction + " " +
			amountWord + " " +
			mode + ".";
	}

	function erase() {
		var ops = bySelection(function(doc, region) {
			return doc.eraseText(region);
		});
		editor.apply(ops);
	}
	erase.description = function() { return "Erase selected text"; };

	function _break_line(doc, region, head) {
		var as = doc.attributesAt(region.begin());
		var breaks = [];
		var ops = [];
		var a;
		for (var i = as.length - 1; i >= 0; i--) {
			var x = as[i];
			breaks.push(x);
			ops.push(ot.operations.pop);
			if (x.type === 'list') break;
		};
		while ((a = breaks.pop())) {
			if (a.type === 'list') {
				ops.push(ot.operations.pushA(a.attributes));
				ops.push(ot.operations.insert(head || a.node.head().sym,'sym'));
			} else {
				ops.push(ot.operations.pushS());
			}
		}
		return doc.replace(region, ops);
	}

	function _break_section(doc, region) {
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

	function _break(args) {
		var f = (args && args.type === 'section') ?
			_break_section : _break_line;
		var ops = bySelection(f, null, args.style);
		editor.apply(ops);
	}
	var bd = _break.description = function(args) {
		return "Insert " + (args.type || "line") + " break.";
	};

	function nop() {
		return;
	}
	nop.description = function() { return "Do nothing"; };

	return {
		undo: undo,
		redo: redo,
		format: format,
		link: link,
		style: style,
		attribute: attribute,
		indent: indent,
		unindent: unindent,
		move: move,
		move_to: moveTo,
		'break': _break,
		nop: nop,
		erase: erase,
		"delete": _delete,
	};
}


var keymap = [
	{keys:["ctrl+b"], command:"format", args:{type:"strong"}},
	{keys:["ctrl+i"], command:"format", args:{type:"em"}},
	{keys:["ctrl+,"], command:"format", args:{type:"sub"}},
	{keys:["ctrl+."], command:"format", args:{type:"sup"}},
	{keys:["ctrl+u"], command:"format", args:{type:"underline"}},
	{keys:["ctrl+`"], command:"format", args:{type:"code"}},
	{keys:["alt+shift+5"], command:"format", args:{type:"strike"}},
	{keys:["ctrl+k"], command:"link"}, //shows a link modal for url

	{keys:["cmd+b"], command:"format", args:{type:"strong"}},
	{keys:["cmd+i"], command:"format", args:{type:"em"}},
	{keys:["cmd+,"], command:"format", args:{type:"sub"}},
	{keys:["cmd+."], command:"format", args:{type:"sup"}},
	{keys:["cmd+u"], command:"format", args:{type:"underline"}},
	{keys:["ctrl+`"], command:"format", args:{type:"code"}},

	{keys:["ctrl+z"], command:"undo"},
	{keys:["ctrl+shift+z"], command:"redo"},

	{keys:["ctrl+]"], command:"indent"},
	{keys:["ctrl+["], command:"unindent"},

	{keys:["ctrl+alt+0"], command:"style", args:{style:"p"}},
	{keys:["ctrl+alt+1"], command:"style", args:{style:"h1"}},
	{keys:["ctrl+alt+2"], command:"style", args:{style:"h2"}},
	{keys:["ctrl+alt+3"], command:"style", args:{style:"h3"}},
	{keys:["ctrl+alt+4"], command:"style", args:{style:"h4"}},
	{keys:["ctrl+alt+5"], command:"style", args:{style:"h5"}},
	{keys:["ctrl+alt+6"], command:"style", args:{style:"h6"}},
	{keys:["ctrl+alt+space"], command:"style", args:{style:"code"}},

	{keys:["enter"], command:"nop"}, //gobble enter key by default
	{keys:["shift+enter"], command:"nop"},
	{keys:["enter"], command:"break", args:{type:"line"},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["enter"], command:"break", args:{type:"line", style:"p"},
		context:[
			{key:"head", operator:"in", operand:["h1","h2","h3","h4","h5","h6","blockquote","pullquote"], match_all:true}
		]},
	{keys:["enter"], command:"style", args:{style:"p"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"in", operand:["code","ulli","olli","blockquote","pullquote"], match_all:true},
			{key:"surrounding_text", operator:"equals", operand:"", match_all:true},
		]},
	{keys:["enter"], command:"break", args:{type:"section"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"surrounding_text", operator:"equals", operand:"", match_all:true},
		]},

	{keys:["ctrl+enter"], command:"break", args:{type:"section"},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["cmd+enter"], command:"break", args:{type:"section"},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},

	//markdown typing (should also remove)
	{keys:["space"], command:"style", args:{style:"h1", remove:"#"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"#", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"h2", remove:"##"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"##", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"h3", remove:"###"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"###", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"ulli", remove:"*"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"*", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"olli", remove:"1."},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"1.", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"blockquote", remove:">"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:">", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"pullquote", remove:">>"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:">>", match_all:true},
		]},
	{keys:["space"], command:"style", args:{style:"code"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"preceding_text", operator:"equals", operand:"", match_all:true},
		]},

	{keys:["ctrl+shift+7"], command:"style", args:{style:"olli"}},
	{keys:["ctrl+shift+8"], command:"style", args:{style:"ulli"}},

	{keys:["ctrl+e"], command:"attribute", args:{key:"alignment", value:"center"}},
	{keys:["ctrl+j"], command:"attribute", args:{key:"alignment", value:"justified"}},
	{keys:["ctrl+r"], command:"attribute", args:{key:"alignment", value:"right"}},
	{keys:["ctrl+l"], command:"attribute", args:{key:"alignment"}}, //left

	//move
	{keys:["right"], command:"move", args:{by:"characters", forward:true}},
	{keys:["left"], command:"move", args:{by:"characters", forward:false}},
	{keys:["down"], command:"move", args:{by:"lines", forward:true}},
	{keys:["up"], command:"move", args:{by:"lines", forward:false}},
	{keys:["ctrl+right"], command:"move", args:{by:"word_ends", forward:true}},
	{keys:["ctrl+left"], command:"move", args:{by:"words", forward:false}},
	{keys:["cmd+right"], command:"move", args:{by:"subwords", forward:true}},
	{keys:["cmd+left"], command:"move", args:{by:"subwords", forward:false}},
	//extend move
	{keys:["shift+right"], command:"move", args:{by:"characters", forward:true, extend:true}},
	{keys:["shift+left"], command:"move", args:{by:"characters", forward:false, extend:true}},
	{keys:["shift+down"], command:"move", args:{by:"lines", forward:true, extend:true}},
	{keys:["shift+up"], command:"move", args:{by:"lines", forward:false, extend:true}},
	{keys:["ctrl+shift+right"], command:"move", args:{by:"word_ends", forward:true, extend:true}},
	{keys:["ctrl+shift+left"], command:"move", args:{by:"words", forward:false, extend:true}},
	//move to
	{keys:["home"], command:"move_to", args:{position:"bol"}},
	{keys:["ctrl+home"], command:"move_to", args:{position:"bof"}},
	{keys:["ctrl+shift+home"], command:"move_to", args:{position:"bof", extend:true}},
	{keys:["shift+home"], command:"move_to", args:{position:"bol", extend:true}},
	{keys:["end"], command:"move_to", args:{position:"hardeol"}},
	{keys:["ctrl+end"], command:"move_to", args:{position:"eof"}},
	{keys:["ctrl+shift+end"], command:"move_to", args:{position:"eof", extend:true}},
	{keys:["shift+end"], command:"move_to", args:{position:"eol", extend:true}},


	{keys:["backspace"], command:"erase"}, //when selection not empty erase
	{keys:["delete"], command:"erase"},
	{keys:["backspace"], command:"delete", args:{forward:false},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
		]},
	{keys:["delete"], command:"delete", args:{forward:true},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
		]},
	{keys:["ctrl+backspace"], command:"delete", args:{by:"word_ends", forward:false},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
		]},
	{keys:["ctrl+delete"], command:"delete", args:{by:"words", forward:true},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
		]},

];

var context_menu = [
	{id:"bold", caption:"Bold", icon:"bold", command:"format", args:{type:"strong"}},
	{id:"italic", caption:"Italic", icon:"italic", command:"format", args:{type:"em"}},
	//etc.
];

module.exports = function(editor) {
	return {
		commands: commands(editor),
		keymap: keymap,
		context_menu: context_menu,
	};	
};