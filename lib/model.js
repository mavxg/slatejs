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

*/

var UNDEFINED;

//e.g. Author, HeaderFragmentId, etc
function Attrib(key, value) {
	this.key = key;
	this.value = value;
};
Attrib.prototype.toJSON = function() {
	return {attrib:this.key, value:this.value};
};
function attrib(key, value) { return new Attrib(key, value); }

//e.g. Link, Bold, etc
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

function TypeSpec(key, id) {
	this._type = key;
	if (id) this.id = id;
}
TypeSpec.prototype.toJSON = function() {
	if (this.id)
		return {_type: this._type, id: this.id};
	return {_type: this._type};
};

function Node(id, children) {
	this.id = id;
	this.children = children || [];
	this.length = 1; //1 for this node
	for (var i = this.children.length - 1; i >= 0; i--) {
		var child = this.children[i];
		this.length += (child.length ? child.length : 1);
	};
}
Node.prototype.toJSON = function() {
	return {
		type: this.className,
		id: this.id,
		children: this.children,
	};
};
Node.prototype.rpn = function(_start, _end, _level, _lin) {
	var lin = _lin || [];
	var start = (_start === UNDEFINED) ? 0 : _start;
	var end = (_end === UNDEFINED) ? this.length : _end;
	var level = (_level === UNDEFINED) ? 0 : _level;
	if (level >= this.level && start <= 0 && end >= this.length) {
		lin.push(this);
		return lin;
	}
	var offset = 0;
	var cl;
	var s;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		cl = child.length || 1;
		if (start < offset + cl && end > offset) {
			s = (start > offset) ? start - offset : 0;
			if (child.rpn) child.rpn(s, end - offset, level, lin);
			else if (child.slice) lin.push(child.slice(s, end - offset));
			else lin.push(child);
		}
		offset += cl;
	};
	if (end >= this.length && start < this.length)
		lin.push(new TypeSpec(this.className, this.id));
	return lin;
};
Node.prototype.maxId = function() {
	if (this._maxId === UNDEFINED) {
		var m = this.id;
		for (var i = this.children.length - 1; i >= 0; i--) {
			var child = this.children[i];
			if (child.maxId) {
				var mid = child.maxId();
				if (mid > m) m = mid;
			}
		};
		this._maxId = m;
	}
	return this._maxId;
}
Node.prototype.className = "Node";
Node.prototype.level     = 0;

function Document (id, children) { Node.call(this, id, children); }
function Section  (id, children) { Node.call(this, id, children); }
function Fragment (id, children) { Node.call(this, id, children); }
function P        (id, children) { Node.call(this, id, children); }
function H1       (id, children) { Node.call(this, id, children); }
function H2       (id, children) { Node.call(this, id, children); }
function H3       (id, children) { Node.call(this, id, children); }
function Quote    (id, children) { Node.call(this, id, children); }
function PullQuote(id, children) { Node.call(this, id, children); }
function Ulli     (id, children) { Node.call(this, id, children); }
function Olli     (id, children) { Node.call(this, id, children); }
function Code     (id, children) { Node.call(this, id, children); }
function Figure   (id, children) { Node.call(this, id, children); }
function Table    (id, children) { Node.call(this, id, children); }
function Row      (id, children) { Node.call(this, id, children); }
function Cell     (id, children) { Node.call(this, id, children); }

Document.prototype            = new Node();
Section.prototype             = new Node();
Fragment.prototype            = new Node();
P.prototype                   = new Node();
H1.prototype                  = new Node();
H2.prototype                  = new Node();
H3.prototype                  = new Node();
Quote.prototype               = new Node();
PullQuote.prototype           = new Node();
Ulli.prototype                = new Node();
Olli.prototype                = new Node();
Code.prototype                = new Node();
Figure.prototype              = new Node();
Table.prototype               = new Node();
Row.prototype                 = new Node();
Cell.prototype                = new Node();

Document.prototype.className  = "Document";
Section.prototype.className   = "Section";
Fragment.prototype.className  = "Fragment";
P.prototype.className         = "P";
H1.prototype.className        = "H1";
H2.prototype.className        = "H2";
H3.prototype.className        = "H3";
Quote.prototype.className     = "Quote";
PullQuote.prototype.className = "PullQuote";
Ulli.prototype.className      = "Ulli";
Olli.prototype.className      = "Olli";
Code.prototype.className      = "Code";
Figure.prototype.className    = "Figure";
Table.prototype.className     = "Table";
Row.prototype.className       = "Row";
Cell.prototype.className      = "Cell";

Document.prototype.level      = 10;
Section.prototype.level       = 9;
Fragment.prototype.level      = 9;
P.prototype.level             = 8;
H1.prototype.level            = 8;
H2.prototype.level            = 8;
H3.prototype.level            = 8;
Quote.prototype.level         = 8;
PullQuote.prototype.level     = 8;
Ulli.prototype.level          = 8;
Olli.prototype.level          = 8;
Code.prototype.level          = 8;
Figure.prototype.level        = 8;
Table.prototype.level         = 8;
Row.prototype.level           = 7;
Cell.prototype.level          = 6;

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

function level(obj) {
	if (obj === UNDEFINED) return 1000000;
	if (obj instanceof Node) return obj.level;
	return 0;
}

function apply(doc, ops) {
	var seed = doc.maxId();
	var stack = [];
	var op;
	var offset = 0;
	var lin;

	if (ops.inputLen !== doc.length)
		throw "Operations input length does not match document length";

	function process(obj) {
		if (obj instanceof TypeSpec) {
			var c = [];
			var klass = KLASS[obj._type] || Node;
			var l = klass.prototype.level;
			for (var i = stack.length - 1; i >= 0; i--) {
				t = stack[i];
				if (level(t) >= l) break;
				c.push(stack.pop());
			};
			c.reverse();
			stack.push(new klass(obj.id, c));
		} else if (typeof obj === 'string' && 
			typeof stack[stack.length - 1] === 'string') {
			stack[stack.length - 1] = stack[stack.length - 1] + obj;
		} else {
			stack.push(obj);
		}
	}

	function fromObj(obj) {
		if (typeof obj === 'string') return obj;
		if (obj._type)  return new TypeSpec(obj._type, obj.id || ++seed);
		if (obj.tag)    return new Tag(this.tag, this.value);
		if (obj.endTag) return new EndTag(this.endTag);
		if (obj.attrib) return new Attrib(this.attrib, this.value);
	}

	for (var i = 0; i < ops.ops.length; i++) {
		var op = ops.ops[i];
		if (ops.isRetain(op)) {
			lin = doc.rpn(offset, offset + op.n, level(stack[stack.length - 1]));
			lin.forEach(process);
		} else if (ops.isInsert(op)) {
			process(fromObj(op.str));
		} else { //remove
			//TODO: check that remove actually matches
		}
		offset += op.inputLen;
	};
	return stack.pop();
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
	attrib    : attrib,
	tag       : tag,
	endtag    : endtag,
	apply     : apply,
};