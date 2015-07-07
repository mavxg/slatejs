
var ot = require('ot-sexpr');

function commands(editor) {

	//(doc -> region -> op) -> selection -> ops
	function bySelection(f, selection) {
		var ops = [];
		function _replace(region) {
			var op = f(editor.state.doc, region);
			ops = ot.compose(ops, ot.transform(op,ops));
		}
		selection.forEachR(_replace);
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
		var attrs = doc.attributesAt(region.focus);
		var attributes = {};
		var unattributes = {};
		if (attrs[type])
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

	function style(args) {
		var remove = args.remove || ""; //remove from start of string.
		console.log("style: " + JSON.stringify(args));
	}
	style.description = function(args) {
		return "Apply paragraph style.";
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
		var mode = args.mode; //characters, words, 
						// wordends, wordboundaries, 
						// lines, wholelines, pages
		var forward = args.forward;
		var amount = args.amount || 1; //number
		var extend = args.extend; //should extend selection

		//TODO
		console.log("Move: " + JSON.stringify(args));
	}

	var numberWords = {
		1:"one",
		2:"two",
	};

	var moveDescriptions = {
		characters: "character",
		words: "word",
		wordends: "word end",
		wordboundaries: "word boundarie",
		lines: "line",
		wholelines: "whole line",
		pages: "page",
	};

	move.description = function(args) {
		var amount = args.amount || 1; 
		var direction = args.forward ? "forward" : "backward";
		var mode = (moveDescriptions[args.mode] || "character") +
					(amount > 1 ? "s" : "");
		var amountWord = numberWords[amount] || amount;
		var extend = args.extend ? "Extend" : "Move";

		return extend + " selection " +
			direction + " " +
			amountWord + " " +
			mode + ".";
	};

	function moveTo(args) {
		var position = args.position; //eol, bol, hardeol, hardbol, eof, bof
		var extend = args.extend; //should extend selection

		//TODO
		console.log("MoveTo: " + JSON.stringify(args));
	};

	var moveToDescriptions = {
		eol: "end of line",
		bol: "beginning of line",
		eolhard: "hard end of line",
		bolhard: "hard beginning of line",
		bof: "beginning of file",
		eof: "end of file",
	};
	moveTo.description = function(args) {
		var position = moveToDescriptions[args.position] || "unknown position";
		var extend = args.extend ? "Extend" : "Move";
		return extend + " selection to " + position + ".";
	};

	function _break(args) {
		var _break = args.type; //line or section

		console.log(bd(args));
	}
	var bd = _break.description = function(args) {
		return "Insert " + (args.type || "line") + " break.";
	};

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
	};
}


var keymap = [
	{keys:["ctrl+b"], command:"format", args:{type:"strong"}},
	{keys:["ctrl+i"], command:"format", args:{type:"em"}},
	{keys:["ctrl+,"], command:"format", args:{type:"sub"}},
	{keys:["ctrl+."], command:"format", args:{type:"sup"}},
	{keys:["ctrl+u"], command:"format", args:{type:"underline"}},
	{keys:["alt+shift+5"], command:"format", args:{type:"strike"}},
	{keys:["ctrl+k"], command:"link"}, //shows a link modal for url

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

	{keys:["enter"], command:"break", args:{type:"line"}},
	{keys:["enter"], command:"break", args:{type:"section"},
		context:[
			{key:"selection_empty", operator:"equals", operand:true, match_all:true},
			{key:"head", operator:"equals", operand:"p", match_all:true},
			{key:"surrounding_text", operator:"equals", operand:"", match_all:true},
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
	{keys:["right"], command:"move", args:{mode:"characters", forward:true}},
	{keys:["left"], command:"move", args:{mode:"characters", forward:false}},
	{keys:["down"], command:"move", args:{mode:"lines", forward:true}},
	{keys:["up"], command:"move", args:{mode:"lines", forward:false}},
	{keys:["ctrl+right"], command:"move", args:{mode:"words", forward:true}},
	{keys:["ctrl+left"], command:"move", args:{mode:"words", forward:false}},
	//extend move
	{keys:["shift+right"], command:"move", args:{mode:"characters", forward:true, extend:true}},
	{keys:["shift+left"], command:"move", args:{mode:"characters", forward:false, extend:true}},
	{keys:["shift+down"], command:"move", args:{mode:"lines", forward:true, extend:true}},
	{keys:["shift+up"], command:"move", args:{mode:"lines", forward:false, extend:true}},
	{keys:["ctrl+shift+right"], command:"move", args:{mode:"words", forward:true, extend:true}},
	{keys:["ctrl+shift+left"], command:"move", args:{mode:"words", forward:false, extend:true}},
	//move to
	{keys:["home"], command:"move_to", args:{position:"bol"}},
	{keys:["ctrl+home"], command:"move_to", args:{position:"bof"}},
	{keys:["shift+home"], command:"move_to", args:{position:"bol", extend:true}},
	{keys:["end"], command:"move_to", args:{position:"eol"}},
	{keys:["ctrl+end"], command:"move_to", args:{position:"eof"}},
	{keys:["shift+end"], command:"move_to", args:{position:"eol", extend:true}},
];

var context_menu = [
	{id:"bold", caption:"Bold", icon:"bold", command:"format", args:{type:"strong"}},
	{id:"italic", caption:"Italic", icon:"italic", command:"format", args:{type:"em"}},
	//etc.
];

module.exports = {
	commands: commands,
	keymap: keymap,
	context_menu: context_menu,
};