
function commands(editor) {
	function undo() { editor.undo(); }
	undo.description = function() { return "Undo previous action."; };

	function redo() { editor.redo(); }
	redo.description = function() { return "Redo previous undo."; };

	function format(args) {
		//TODO
		console.log("format: " + JSON.stringify(args));
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
		console.log("style: " + JSON.stringify(args));
	}
	style.description = function(args) {
		return "Apply paragraph style.";
	};

	function attribute(args) {

	}
	attribute.description = function(args) {
		return "Apply paragraph attributes."
	};


	return {
		undo: undo,
		redo: redo,
		format: format,
		link: link,
		style: style,
		attribute: attribute,
	};
}

var keymap = [
	{keys:["ctrl+b"], command:"format", args:{type:"strong"}},
	{keys:["ctrl+i"], command:"format", args:{type:"em"}},
	{keys:["ctrl+,"], command:"format", args:{type:"sub"}},
	{keys:["ctrl+."], command:"format", args:{type:"sup"}},
	{keys:["ctrl+u"], command:"format", args:{type:"u"}}, //underline
	{keys:["alt+shift+5"], command:"format", args:{type:"strike"}},
	{keys:["ctrl+k"], command:"link"}, //shows a link modal for url

	{keys:["ctrl+z"], command:"undo"},
	{keys:["ctrl+shift+z"], command:"redo"},

	{keys:["ctrl+alt+0"], command:"style", args:{style:"p"}},
	{keys:["ctrl+alt+1"], command:"style", args:{style:"h1"}},
	{keys:["ctrl+alt+2"], command:"style", args:{style:"h2"}},
	{keys:["ctrl+alt+3"], command:"style", args:{style:"h3"}},
	{keys:["ctrl+alt+4"], command:"style", args:{style:"h4"}},
	{keys:["ctrl+alt+5"], command:"style", args:{style:"h5"}},
	{keys:["ctrl+alt+6"], command:"style", args:{style:"h6"}},

	{keys:["ctrl+shift+7"], command:"style", args:{style:"olli"}},
	{keys:["ctrl+shift+8"], command:"style", args:{style:"ulli"}},

	{keys:["ctrl+e"], command:"attribute", args:{key:"alignment", value:"center"}},
	{keys:["ctrl+j"], command:"attribute", args:{key:"alignment", value:"justified"}},
	{keys:["ctrl+r"], command:"attribute", args:{key:"alignment", value:"right"}},
	{keys:["ctrl+l"], command:"attribute", args:{key:"alignment"}}, //left
];

module.exports = {
	keymap: keymap,
};