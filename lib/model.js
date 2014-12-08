/*

TODO:

Change this document structure so that every start and end character
takes one character position. Every attribute takes one character.

This means there is no longer a one to one relationship between character
position of the cursor and position in the document. 

... We then only have 3 actions.

Retain
Remove
Insert (this can be text or an object)

[1,-1,{obj},"text"]

An obj counts as a single character, -1 is delete 1 character

OT algorithm can ignore the nesting of start/end tags.

Most tags don't need a start and end (they go back to where they make sense)

{cell} -- goes back to previous row/cell/paragraph tag.

Cannot have the empty string as a concept unless we put an empty string end
character (probably not needed.)


.........

INVARIANTS

* Must have newline and cell separator characters as
  you can place a cursor either side of them.

  -- separators (they are not part of either the cell or the paragraph)

* Don\'t have to split on newline characters. Can put attributes into the document
  to say what they are.

*/

var operations = require('./operations');

var UNDEFINED;


function Attrib(key, value) {
	this.key = key;
	this.value = value;
};
Attrib.prototype.toJSON = function() {
	return {attrib:this.key, value:this.value};
};
function attrib(key, value) { return new Attrib(key, value); }

//Links or Bold etc
function Tag(key, value) {
	this.key = key;
	this.value = value;
};
Tag.prototype.toJSON = function() {
	return {tag:this.key, value:this.value};
};
function tag(key, value) { return new Tag(key, value); }

function EndTag(key) {
	this.key = key;
};
EndTag.prototype.toJSON = function() {
	return {endTag:this.key};
};
function endtag(key) { return new EndTag(key); }

function Node(children, attribs) {
	this.children = children || [];
	this.attributes = attribs || [];
	this.length = 1; //for this node
	for (var i = this.children.length - 1; i >= 0; i--) {
		var child = this.children[i];
		this.length += (child.length ? child.length : 1);
	};
}
Node.prototype.toJSON = function(first_argument) {
	return {
		type: this.className,
		children: this.children,
		attributes: this.attributes,
	};
};
Node.prototype.className = "Node";
Node.prototype.level = 0;

function Document (children, attribs) { Node.call(this, children, attribs); }
function Section  (children, attribs) { Node.call(this, children, attribs); }
function Fragment (children, attribs) { Node.call(this, children, attribs); }
function P        (children, attribs) { Node.call(this, children, attribs); }
function H1       (children, attribs) { Node.call(this, children, attribs); }
function H2       (children, attribs) { Node.call(this, children, attribs); }
function H3       (children, attribs) { Node.call(this, children, attribs); }
function Quote    (children, attribs) { Node.call(this, children, attribs); }
function PullQuote(children, attribs) { Node.call(this, children, attribs); }
function Ulli     (children, attribs) { Node.call(this, children, attribs); }
function Olli     (children, attribs) { Node.call(this, children, attribs); }
function Code     (children, attribs) { Node.call(this, children, attribs); }
function Figure   (children, attribs) { Node.call(this, children, attribs); }
function Table    (children, attribs) { Node.call(this, children, attribs); }
function Row      (children, attribs) { Node.call(this, children, attribs); }
function Cell     (children, attribs) { Node.call(this, children, attribs); }

Document.prototype = new Node();
Section.prototype = new Node();
Fragment.prototype = new Node();
P.prototype= new Node();
H1.prototype = new Node();
H2.prototype = new Node();
H3.prototype = new Node();
Quote.prototype = new Node();
PullQuote.prototype = new Node();
Ulli.prototype = new Node();
Olli.prototype = new Node();
Code.prototype = new Node();
Figure.prototype = new Node();
Table.prototype = new Node();
Row.prototype = new Node();
Cell.prototype = new Node();

Document.prototype.className = "Document";
Section.prototype.className = "Section";
Fragment.prototype.className = "Fragment";
P.prototype.className = "P";
H1.prototype.className = "H1";
H2.prototype.className = "H2";
H3.prototype.className = "H3";
Quote.prototype.className = "Quote";
PullQuote.prototype.className = "PullQuote";
Ulli.prototype.className = "Ulli";
Olli.prototype.className = "Olli";
Code.prototype.className = "Code";
Figure.prototype.className = "Figure";
Table.prototype.className = "Table";
Row.prototype.className = "Row";
Cell.prototype.className = "Cell";

Document.prototype.level = 10;
Section.prototype.level = 9;
Fragment.prototype.level = 9;
P.prototype.level = 8;
H1.prototype.level = 8;
H2.prototype.level = 8;
H3.prototype.level = 8;
Quote.prototype.level = 8;
PullQuote.prototype.level = 8;
Ulli.prototype.level = 8;
Olli.prototype.level = 8;
Code.prototype.level = 8;
Figure.prototype.level = 8;
Table.prototype.level = 8;
Row.prototype.level = 7;
Cell.prototype.level = 6;

var KLASS = {
	Document  : Document,
	Section   : Section,
	Fragment  : Fragment,
	P         : P,
	H1        : H1,
	H2        : H2,
	H3        : H3,
	Quote     : Quote,
	PullQuote : PullQuote,
	Ulli      : Ulli,
	Olli      : Olli,
	Code      : Code,
	Figure    : Figure,
	Table     : Table,
	Row       : Row,
	Cell      : Cell,
};

function apply(doc, ops) {
	//TODO:
};

module.exports = {
	Node      : Node,
	Document  : Document,
	Section   : Section,
	Fragment  : Fragment,
	P         : P,
	H1        : H1,
	H2        : H2,
	H3        : H3,
	Quote     : Quote,
	PullQuote : PullQuote,
	Ulli      : Ulli,
	Olli      : Olli,
	Code      : Code,
	Figure    : Figure,
	Table     : Table,
	Row       : Row,
	Cell      : Cell,
};