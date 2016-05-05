var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var TABLE_CLASS = 'pure-table pure-table-bordered';

var ottype = require('ot-sexpr');
var sym = ottype.sym;
var Selection = ottype.Selection;
var Region = ottype.Region;
var AttributedString = ottype.AttributedString;

var keyToId = require('./ids').keyToId;

function renderChildren(children, _sel, parentId, editor, parent, path, onlySelection) {
	var stack = [];
	var ret = [];
	var wrapped = null;
	var indent = 0;
	var subsel;
	var sel = _sel || new Selection();
	var offset = 2; //skip up and head

	if (onlySelection &&
		sel.regions.every(function(r) { return r.empty(); }))
	  return [DOM.text("\u200B")];

	function wrap(_type, wtag, id, cindent) {
		while (indent < cindent) {
			indent++;
			stack.push({c:ret, tag:wtag, type:wrapped, props:{id:('_' + keyToId(id) + '_' + indent)}});
		}
		wrapped = _type;
		ret = [];
	}

	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		if (!child) {
			console.log("What happened")
		}

		//TODO: check if in selection...
		if (typeof child === 'string' ||
			typeof child === 'number' ||
			child instanceof String ||
			child instanceof Number) {
			ret.push(DOM.span({},child.toString()));
			offset += 1;
			continue;
		}

		if (child.type && child.type === 'string') {
			subsel = sel.slice(offset+1,offset + child.size-1);
			var _chunks = (child.length > 0) ? child.chunk() : [{str:"\u00A0", attributes:{}}];
			var chunks = [];
			//split chunks by newlines
			for (var k = 0; k < _chunks.length; k++) {
				var ch = _chunks[k];
				var s = ch.str.split('\n');
				//intersperse with newlines
				for (var j = 0; j < s.length; j++) {
					if (j > 0)
						chunks.push({str:"\n"});
					var x = s[j];
					chunks.push({str:(x === "" ? "\u00A0" : x), attributes:ch.attributes});
				};
			};
			var coff = 0;
			for (var j = 0; j < chunks.length; j++) {
				var chunk = chunks[j];
				if (chunk.str === '\n') {
					ret.push(DOM.br());
					coff++;
					continue;
				}
				var attr = chunk.attributes;
				var l = chunk.str.length;
				var o = 0;
				var c = [];
				var key;
				var subsubsel = subsel.slice(coff, coff+l);
				function fs(s) {
					s = s.replace(/  +/g,fixSpaces);//.replace(/ $/,fixSpaces);
					return s;
				}
				//(  [...)...(....)...(...]...)
				//(  [...]  )
				for (var k = 0; k < subsubsel.regions.length; k++) {
					var r = subsubsel.regions[k];
					var beg = r.begin();
					var end = r.end();
					if (beg > o) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + o);
						if (!onlySelection)
							c.push(DOM.span({id:key},fs(chunk.str.slice(o,beg))));
						o = beg;
					}
					if (r.focus === beg && beg >= 0 && !onlySelection) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + beg) + '_cursor';
						c.push(DOM.span({id:key,className:'cursor'},"\u200B"));
					}
					if (end > o) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + o);
						if (onlySelection)
							c.push(DOM.span({},fs(chunk.str.slice(o,end))));
						else
							c.push(DOM.span(
								{id:key,className:'selected'},
								fs(chunk.str.slice(o,end))));
					}
					if (r.focus === end && end <= l && end > beg && (coff + 1 + end) < child.length
						&& !onlySelection) {
						key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + end) + '_cursor';
						c.push(DOM.span({id:key,className:'cursor'},"\u200B"));
					}
					o = end;
				};
				if ((o < l || o === 0) && !onlySelection) {
					key = keyToId(parentId) + ':' + (i+1) + ':' + (coff + 1 + o);
					c.push(DOM.span({id:key},fs(chunk.str.slice(o,l).replace(/ $/,fixSpaces))));
				}
				if (attr.strong)
					c = [DOM.strong({},c)];
				if (attr.em)
					c = [DOM.em({},c)];
				if (attr.sup)
					c = [DOM.sup({},c)];
				if (attr.sub)
					c = [DOM.sub({},c)];
				if (attr.code)
					c = [DOM.code({},c)];
				if (attr.strike)
					c = [DOM.del({},c)];
				if (attr.underline)
					c = [DOM.span({style:{"text-decoration":"underline"}},c)];
				if (attr.href)
					c = [DOM.a({href:attr.href},c)];
				ret = ret.concat(c);
				coff += l;
			};
			offset += child.size;
			continue;
		}
		if (child.___skip) {
			offset += child.___skip;
			continue;
		}
		if (typeof child.head !== 'function') {
			offset += 1;
			continue; //skip objects
		}
		var _type = child.head().sym;
		var attr = child.attributes || {};
		var cindent = (attr.indent || 1);
		var subsel = sel.slice(offset, offset + child.size);
		if (onlySelection && subsel.regions.every(function(r) { return r.empty(); })) {
			offset += child.size;
			continue; //skip as not selected
		}
		if (wrapped !== null && (wrapped !== _type || cindent < indent))  {
			//unwrap
			var t;
			while ((t=stack.pop()) !== undefined) {
				indent--;
				if (ret.length === 0) 
					ret.push(DOM.text("\u00A0"));
				t.c.push(DOM[t.tag](Object.create(t.props),ret));
				ret = t.c;
				wrapped = t.type;
				if (wrapped === _type && cindent === indent) break;
			}
		}
		var renderer = renderers[_type];
		if (renderer) {
			if (renderer.wrap && cindent > indent)
				wrap(_type, renderer.wrap,child.id, cindent);
			ret.push(renderer({
				obj:child,
				selection:subsel,
				key:keyToId(child.id),
				editor:editor,
				parent:parent,
				path:path,
				onlySelection:onlySelection
			}));
			if (renderer.after && !onlySelection)
				ret.push(DOM.text(renderer.after));
		}	
		offset += child.size;
	};

	var t;
	while ((t=stack.pop()) !== undefined) {
		if (ret.length === 0) 
				ret.push(DOM.text("\u00A0"));
		t.c.push(DOM[t.tag](Object.create(t.props),ret));
		ret = t.c;
	}
	return ret;
}

function fixSpaces(m) {
	var ret = '';
	for (var i = m.length; i >= 1; i--) ret += "\u00A0";
	return ret;
}

function selectionEqual(a,b) {
	if (a instanceof Selection) {
		if (!(b instanceof Selection)) return false;
	} else {
		return !(b instanceof Selection)
	}
	if (!a.equals(b)) return false;
	if (a.table_regions || b.table_regions)
		return false;
	return true;
}

function shouldComponentUpdate(nextProps, nextState) {
	if (this.state !== nextState) return true;
	var a = nextProps;
	var b = this.props;
	var nks = Object.keys(a);
	var oks = Object.keys(b);
	if (nks.length !== oks.length) return true;
	for (var k in a) {
		if (typeof a[k] !== typeof b[k]) return true;
		if (a[k] === undefined && b[k] === undefined) continue;
		if (k === 'selection') {
			if (!selectionEqual(a[k],b[k]))
				return true;
		} else if (k === 'children') {
			if (a[k].length !== b[k].length) return true;
			for (var i = a[k].length - 1; i >= 0; i--) {
				if (a[k][i] !== b[k][i]) return true;
			};
		} else if (a[k] !== b[k]) {
			return true;
		}
	}
	return false;
}

function makeClass(tag, className) {
	return createClass({
		shouldComponentUpdate: shouldComponentUpdate,
		render: function() {
			var obj = this.props.obj;
			var path = this.props.path ? this.props.path.slice(0) : [];
			path.push(obj.id);
			var props = {
				id: keyToId(obj.id),
			};
			if (this.props.onlySelection)
				props.id += '_selected';
			props.className = (className !== undefined) ? className : '';
			if (className === 'result' && this.props.selection.regions.length > 0 ) {
				var r = this.props.selection.regions[0];
				if (r.begin() <= 0 && r.end() >= 2)
					props.className += ' selected';
			}
			//TODO: probably want to just iterate over attributes
			if (obj.alt)     props.alt     = obj.alt;
			if (obj.title)   props.title   = obj.title;
			if (obj.src)     props.src     = obj.src;
			if (obj.href)    props.href    = obj.href;
			var children = obj.values.slice(1);
			if (children.length === 0) children = ["\u00A0"];
			return DOM[tag](props, renderChildren(children, this.props.selection, obj.id, this.props.editor, obj, path, this.props.onlySelection));
		}
	});
}

var Result     = makeClass('div', 'result');
var Error      = makeClass('pre', 'error');
var Node       = makeClass('span');
var Pre        = makeClass('pre');
var H1         = makeClass('h1');
var H2         = makeClass('h2');
var H3         = makeClass('h3');
var H4         = makeClass('h4');
var H5         = makeClass('h5');
var H6         = makeClass('h6');
//var Section    = makeClass('section');
var Document   = makeClass('div', 'doc');
var P          = makeClass('p');
var Quote      = makeClass('blockquote');
var PullQuote  = makeClass('blockquote', 'pullquote');
var Fragment   = makeClass('span', 'fragment');
var Figure     = makeClass('figure');
var FigCaption = makeClass('figcaption');
var Image      = makeClass('img');
var Ulli       = makeClass('li'); //wrap with UL or OL
var Olli       = makeClass('li'); //wrap with UL or OL
var Code       = makeClass('code'); //wrap with div>(pre + result)


var Html = createClass({
	render: function() {
		var obj = this.props.obj;
		var html = obj.index(1).html;
		var w = document.createElement('div');
		w.innerHTML = html;
		return friar.Wrap(w);
	}
})

var Section = createClass({
	shouldComponentUpdate: shouldComponentUpdate,
	render: function() {
		var obj = this.props.obj;
		var parent = this.props.parent;
		var path = this.props.path ? this.props.path.slice(0) : [];
		path.push(obj.id);
		var props = {
			id: keyToId(obj.id),
			className: 'content',
		};
		var children = obj.tail();
		if (children.length === 0) children = ["\u00A0"];
		var rchildren = renderChildren(children, this.props.selection, obj.id, this.props.editor, this.props.obj, path, this.props.onlySelection);
		var ind = parent.values.indexOf(obj);
		var ns = parent.index(ind+1);
		//var ns = obj.nextSibling();
		if (ns && ns.head && ns.head() === obj.head())
			rchildren.push(DOM.hr({id: keyToId(obj.id) + ":" + 0 + ":" + (obj.size-4) + "_hr"}))
		return DOM.section(props, rchildren);
	}
});

var Row = createClass({
	shouldComponentUpdate: shouldComponentUpdate,
	render: function() {
		var row = this.props.row;
		var tag = this.props.tag;
		var sel = this.props.selection;
		var alignments = this.props.alignments || [];
		var onlySelection = !!this.props.onlySelection;
		var table_selected = !!this.props.selected; //whole table selected
		var classes = this.props.classes || [];
		var cells = [];
		var offset = 0;
		var raw_cells = row.tail();
		var soffset = 2;

		var path = this.props.path ? this.props.path.slice(0) : [];
		path.push(row.id);

		var table_regions = sel.table_regions || [];

		for (var i = 0; i < raw_cells.length; i++) {
			var cellx = raw_cells[i];
			var subsel = sel.slice(soffset, soffset + cellx.size);
			var cell = cellx.attributes || {};
			soffset += cellx.size;
			var selected = table_selected;

			var alignment = alignments[i + offset] || 'left';
			var cpath = path.slice(0);
			cpath.push(cellx.id);
			var props = {
				id: keyToId(cellx.id)
			};
			for (var j = table_regions.length - 1; j >= 0; j--) {
				var r = table_regions[j];
				if (r.start_col <= i && r.end_col >= i) {
					props.className = 'selected';
					selected = true;
				}
			};
			if (cell.colSpan) props.colSpan = cell.colSpan;
			if (cell.rowSpan) props.rowSpan = cell.rowSpan;
			if (cell.errors && cell.errors.length > 0) {
				props.className = 'error';
				props.title = cell.errors.join('\n');
			} else if (cell.className) props.className =
				(props.className ? props.className + ' ' : '') + cell.className;
			if (classes[i + offset]) props.className = classes[i + offset];
			if (alignment !== 'left') {
				props.style = {};
				props.style['text-align'] = alignment;
			}
			if (onlySelection &&
				(!selected) &&
				subsel.regions.every(function(r) { return r.empty(); })) {
				//do nothing we don't have a selection
			} else {
				//
				var children = cellx.tail();
				if (children.length === 0) children = [DOM.text("\u200B")];
				else children = renderChildren(children, onlySelection ? null : subsel, cellx.id, this.props.editor, this.props.row, cpath, onlySelection && (!selected));
				cells.push(DOM[tag || 'td'](props, children)); ;
			}
			
			if (cell.colSpan) offset += cell.colSpan - 1;
		}
		return DOM['tr']({ id: keyToId(row.id) }, cells);
	}
});


var _table = sym('table');
var _row = sym('row');

//cellAt takes an offset within the table
//node (including start of node)
_table.cellAt = function(node, _offset) {
	var offset = _offset - 2;
	var cl;
	var row = 0;
	var children = node.tail();
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		cl = child.size;
		if (offset <= cl) {
			return _row.cellAt(child, offset, row);
		}
		row++;
		offset -= cl;
	};
	return _row.cellAt(child, cl - 1, row-1);
};
//cellAt takes an offset within the row
//node (including start of node)
//returns {node:cell, offset:remainder, col:..., row:...}
_row.cellAt = function(node, _offset, row) {
	var offset = _offset - 2;
	var cl;
	var col = 0;
	var children = node.tail();
	for (var i = 0; i < children.length; i++) {
		var child = children[i];
		cl = child.size;
		if (offset <= cl) {
			return {node: child, offset: offset - 1, column: col, row: row};
		}
		col++;
		offset -= cl;
	};
	return {node:child, offset: offset - 1, column: col - 1, row: row};
};

var Table = createClass({
	shouldComponentUpdate: shouldComponentUpdate,
	render: function() {
		var table = this.props.obj;
		var rows = table.tail();
		var sel = this.props.selection;
		var onlySelection = this.props.onlySelection;
		var selected = false;

		var path = this.props.path ? this.props.path.slice(0) : [];
		path.push(table.id);

		var props = {
			id: keyToId(table.id),
			className: TABLE_CLASS,
		};
		if (sel.regions.length > 0 && 
			(sel.regions[0].begin() < 2 || 
				sel.regions[sel.regions.length-1].end() >= table.size)) {
			props.className += ' selected';
			selected = true;
			//colapse the selection to just focus
			//so we can draw any cursors (even though we have selected the whole table)
			sel = new Selection(sel.regions.map(function(r) { return new Region(r.focus)}));
		}
		var numRows = rows.length;
		var headerRows = [];
		var attributes = table.attributes || {}
		var bodyRows = [];
		var numHeaderRows = attributes.headerRows || 0;

		//adjust the regions (for cell selection)
		//TODO: factor this out as we will need it for
		//actions. (should probably just be called adjust selection)
		var nregs = [];
		var table_regions = []
		for (var j = 0; j < sel.regions.length; j++) {
			var r = sel.regions[j];
			var start = r.begin();
			var end = r.end();
			var startCell =  _table.cellAt(table, start);
			if (start < 2 || start >= table.size ||
				start - startCell.offset + startCell.node.size > end) {
				//range within a single cell
			} else {
				//select cell ranges
				var endCell = _table.cellAt(table, end);
				var minCol = Math.min(startCell.column, endCell.column);
				var minRow = Math.min(startCell.row, endCell.row);
				var sAttr = startCell.node.attributes || {};
				var eAttr = endCell.node.attributes || {};
				var maxCol = Math.max(startCell.column + (sAttr.colSpan || 1) - 1,
					endCell.column + (eAttr.colSpan || 1) - 1);
				var maxRow = Math.max(startCell.row + (sAttr.rowSpan || 1) - 1,
					endCell.row + (eAttr.rowSpan || 1) - 1);
				r = new Region(r.focus);
				table_regions.push({start_row:minRow, start_col:minCol, 
					end_row:maxRow, end_col:maxCol});
			}
			nregs.push(r)
		};
		sel = new Selection(nregs);
		if (table_regions.length > 0) {
			sel.table_regions = table_regions;
		}
		console.log(JSON.stringify(sel))

		var row;
		var i = 0;
		var offset = 2;

		function _slice_table_regions(selc, row_num) {
			if (!selc.table_regions) return selc;
			var ret = [];
			var rs = new Selection(selc.focus, selc.anchor);
			for (var i = 0; i < sel.table_regions.length; i++) {
				var r = selc.table_regions[i];
				if (r.start_row <= row_num && r.end_row >= row_num)
					ret.push(r);
			};
			if (ret.length > 0)
				rs.table_regions = ret;
			return rs;
		}

		for (; i < numHeaderRows && i < numRows; i++) {
			row = rows[i];
			var trs = _slice_table_regions(sel.slice(offset,offset + row.size),i);
			//TODO: check if we shouldn't render the row at all
			if (!(onlySelection
				&& !selected
				&& trs.table_regions === undefined
				&& trs.regions.every(function(r) { return r.empty(); }))) {
				headerRows.push(Row({
					row: row,
					onlySelection: this.props.onlySelection,
					selection: trs,
					selected: selected,
					path: path,
					key: keyToId(row.id),
					tag: 'th',
					alignments: attributes.alignments,
					classes: attributes.classes,
					headerCols: attributes.headerCols,
					editor: this.props.editor,
				}));
			}
			offset += row.size;
		}
		for (; i < numRows; i++) {
			row = rows[i];
			var trs = _slice_table_regions(sel.slice(offset,offset + row.size),i);
			//TODO: check if we shouldn't render the row at all.
			if (!(onlySelection
				&& !selected
				&& trs.table_regions === undefined
				&& trs.regions.every(function(r) { return r.empty(); }))) {
				bodyRows.push(Row({
					row: row,
					onlySelection: this.props.onlySelection,
					selection: trs,
					selected: selected,
					path: path,
					rowNumber: i,
					tag: 'td',
					alignments: attributes.alignments,
					classes: attributes.classes,
					headerCols: attributes.headerCols,
					editor: this.props.editor,
				}));
			}
			offset += row.size;
		}
		return DOM.table(props, [
			DOM.thead({}, headerRows),
			DOM.tbody({}, bodyRows),
			DOM.tfoot({}, [])
		]);

	}
});

Olli.wrap = 'ol';
Ulli.wrap = 'ul';
Code.wrap = 'pre';
Code.after = '\n';

var renderers = {
	'doc': Document,
	'section': Section,
	'p': P,
	'h1': H1,
	'h2': H2,
	'h3': H3,
	'h4': H4,
	'h5': H5,
	'h6': H6,
	'blockquote': Quote,
	'pullquote': PullQuote,
	'result':    Result,
	'error':    Error,
	'html':    Html,
	'pre':    Pre,
	'ulli': Ulli,
	'olli': Olli,
	'code': Code,
	'table': Table,  
};

//Render document
var Preview = createClass({
	render: function() {
		console.log('Preview: ' + JSON.stringify(this.props.selection));
		return Document({obj: this.props.doc,
			onlySelection: this.props.onlySelection,
			selection:this.props.selection,
			editor:this.props.editor});
	}
});

module.exports = {
	Preview: Preview,
	renderers: renderers,
	renderChildren: renderChildren,
}