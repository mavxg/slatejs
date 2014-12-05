//Render the document content to a DOM node
// and handle document/window events

var friar = require('friar');
var model = require('./model');

var createClass = friar.createClass;
var DOM         = friar.DOM;

/*
var Document = model.Document,
    Fragment = model.Fragment,
    Section  = model.Section,
    P        = model.P, 
    Header   = model.Header,
    Quote    = model.Quote,
    Ulli     = model.Ulli,
    Olli     = model.Olli,
    Figure   = model.Figure,
    Code     = model.Code,
    Table    = model.Table,
    Row      = model.Row,
    Cell     = model.Cell,
    Link     = model.Link,
    Strong   = model.Strong,
    Em       = model.Em,
    Sub      = model.Sub,
    Sup      = model.Sup;
*/


var keyNames = {
	3: "Enter", 8: "Backspace", 9: "Tab", 
	13: "Enter", 16: "Shift", 17: "Ctrl", 
	18: "Alt", 19: "Pause", 20: "CapsLock", 
	27: "Esc", 32: "Space", 33: "PageUp", 
	34: "PageDown", 35: "End",36: "Home", 
	37: "Left", 38: "Up", 39: "Right", 
	40: "Down", 44: "PrintScrn", 45: "Insert",
    46: "Delete", 59: ";", 61: "=", 
    91: "Mod", 92: "Mod", 93: "Mod", 
    107: "=", 109: "-", 127: "Delete",
    173: "-", 186: ";", 187: "=", 
    188: ",", 189: "-", 190: ".", 
    191: "/", 192: "`", 219: "[", 
    220: "\\", 221: "]", 222: "'", 
    63232: "Up", 63233: "Down", 63234: "Left", 
    63235: "Right", 63272: "Delete", 63273: "Home", 
    63275: "End", 63276: "PageUp", 63277: "PageDown", 
    63302: "Insert"
};
(function() {
    // Number keys
    for (var i = 0; i < 10; i++) keyNames[i + 48] = keyNames[i + 96] = String(i);
    // Alphabetic keys
    for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i);
    // Function keys
    for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i;
  })();

var keyName = function(event) {
    var base = keyNames[event.keyCode], name = base;
    if (name == null || event.altGraphKey) return false;
    if (event.altKey && base != "Alt") name = "Alt-" + name;
    if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name;
    if (event.metaKey && base != "Cmd") name = "Cmd-" + name;
    if (event.shiftKey && base != "Shift") name = "Shift-" + name;
    return name;
};

function noop() {}

//TODO
function copy(e, editor) {}
function cut(e, editor) {}
function undo(e, editor) {}
function redo(e, editor) {}
function paste(e, editor) {}
function moveH(dir, extend) {
	return noop;
}
function moveV(dir, extend) {
	return noop;
}

var keymap = {
	'Ctrl-C': copy,
	'Cmd-C': copy,
	'Ctrl-X': cut,
	'Cmd-X': cut,
	'Ctrl-Z': undo,
	'Cmd-Z': undo,
	'Ctrl-Y': undo,
	'Cmd-Shift-Z': redo,
	'Ctrl': noop,
	'Ctrl-Shift': noop,
	'Shift': noop,
	'Alt': noop,
	'Cmd': noop,
	'Cmd-Shift': noop,
	'Shift-Left': moveH(-1, true),
	'Shift-Right': moveH(1, true),
	'Shift-Up': moveV(-1, true),
	'Shift-Down': moveV(1, true),
	'Left': moveH(-1),
	'Right': moveH(1),
	'Up': moveV(-1),
	'Down': moveV(1),
};

//Render a selection
var Selection = createClass({

});

//Render document
var Preview = createClass({

});

var HiddenTextArea = createClass({
	handleKeyDown: function(e) {

	},
	handleKeyUp: function(e) {

	},
	handleChange: function(e) {

	},
	handleInput: function(e) {

	},
	handleFocus: function(e) {
		if (this.props.onFocus) this.props.onFocus(e);
	},
	handleBlur: function(e) {
		if (this.props.onBlur) this.props.onBlur(e);
	},
	render: function() {
		return DOM.textarea({
			className: 'hiddenTextArea',
			style:     this.props.style,
			onKeyDown: this.handleKeyDown,
			onKeyUp:   this.handleKeyUp,
			onChange:  this.handleChange,
			onInput:   this.handleInput,
			onFocus:   this.handleFocus,
			onBlur:    this.handleBlur,
		});
	}
});

var Editor = createClass({
	willUnmount: function() {
		//
	},
	render: function() {
	}
});


module.exports = {
	Editor: Editor,
};