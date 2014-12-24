//actions that can be performed on a store/editor.

var model = require('./model');
var Operations = require('./operations');

function _defaultSplit(typespec, ins, removes, isStart, isEnd, offset, attribs, tags, endtags) {
	var op = new Operations();
	switch (typespec._type) {
		case 'Cell':
			if (ins.length > 0) break; //no spliting a cell
			op.retain(offset);
			op.insert('\n');
			break;
		case 'P':
			if (isStart && isEnd && ins.length === 0) {
				op.retain(offset - (attribs.length + 1));
				op.insert({_type: 'Section'}); 
				break;
			}
			//fall to default:
		case 'Quote':
		case 'PullQuote':
		case 'Ulli':
		case 'Olli':
		case 'Code':
			if (isStart && isEnd && ins.length === 0) {
				op.retain(offset - (attribs.length + 1));
				op.remove(typespec);
				attribs.forEach(op.remove, op);
				removes.forEach(op.remove, op);
				op.insert({_type: 'P'}); //change to a P if empty and we press enter
				break;
			}
			//fall to default:
		default:
			op.retain(offset);
			removes.forEach(op.remove, op);
			tags.forEach(function(t) {
				op.insert({endTag: t.key});
			});
			ins.forEach(op.insert, op);
			op.insert({_type: typespec._type});
			tags.forEach(op.insert, op);
	}
	return op;
}

function split(st, ins, _callback) {
	var callback = _callback || _defaultSplit;
	var sel = st.selection;
	//TODO: mulitple selection
	var doc = st.document;
	var offset = sel.start();
	var pre = doc.prefix(0, offset);
	var endtags = [];
	var tags = [];
	var attribs = [];
	var typespec = {_type: 'P'};
	var removes = [];
	var isEnd = true;
	var isStart = true;
	var post = doc.prefix(sel.end());
	if (!sel.isCollapsed()) {
		isEnd = false;
		removes = doc.prefix(sel.start(), sel.end(), true);
	}

	function processTag(op) {
		var i = endtags.lastIndexOf(op.key);
		if (i === -1) {
			tags.push(op);
			return;
		}
		endtags = endtags.splice(i, 1);
	}

	for (var i = pre.length - 1; i >= 0; i--) {
		var op = pre[i];
		var ty = model.type(op)
		if (ty === 'typespec') {
			typespec = op; 
			break;
		} else if (ty === 'attrib') {
			attribs.push(op);
		} else if (ty === 'tag') {
			processTag(op);
			isStart = false;
		} else if (ty === 'endtags') {
			endtags.push(op.key);
			isStart = false;
		} else if (ty === 'string') {
			isStart = false;
		}
	};
	attribs.reverse();

	//TODO: assert endtags is empty
	//TODO: make end tags the current open start tags
	// and then start tags are the startTags
	// which are not ended by the removed tags.
	endtags = [];

	for (i = 0; i < post.length; i++) {
		op = post[i];
		ty = model.type(op);
		if (ty === 'string') {
			isEnd = false;
		} else if (ty === 'endtags') {
			//TODO: something here with end tags
		} else if (ty === 'tag') {
			//TODO: something here with tags
		} else if (ty === 'attrib') {
			//pass
		} else {
			break;
		}
	}

	var op = callback(typespec, ins, removes, isStart, isEnd, offset, attribs, tags, endtags)
	op.end(doc.length);
	st.apply(op);
}

module.exports = {
	goLineUp:        function(st, ed) {ed.moveV(-1, 'line');},
	goLineDown:      function(st, ed) {ed.moveV(1, 'line');},
	goCharLeft:      function(st, ed) {ed.moveH(-1, 'char');},
	goCharRight:     function(st, ed) {ed.moveH(1, 'char');},
	extendLineUp:    function(st, ed) {ed.moveV(-1, 'line', true);},
	extendLineDown:  function(st, ed) {ed.moveV(1, 'line', true);},
	extendCharLeft:  function(st, ed) {ed.moveH(-1, 'char', true);},
	extendCharRight: function(st, ed) {ed.moveH(1, 'char', true);},
	delCharBefore:   function(st, ed) {ed.deleteH(-1, 'char');},
    delCharAfter:    function(st, ed) {ed.deleteH(1, 'char');},
    newline:         function(st, ed) {split(st, []);},
    undo:            function(st, ed) {st.undo();},
    redo:            function(st, ed) {st.redo();}
};