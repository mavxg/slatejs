//Table commands.
var ot = require('ot-sexpr');
var sym = ot.sym;

/*
var List = ot.List;
List.prototype.indexOfHead = function(head, start) {
	start = start || 0;
	if (typeof head === 'string')
		head = sym(head);
	if (head === this.head())
		return 0;
};
List.prototype.lastIndexOfHead = function(head, start) {
	start = start || this.size;
	if (typeof head === 'string')
		head = sym(head);
	if (head === this.head())
		return 0;
};
*/
var Selection = ot.Selection;
var Region = ot.Region;

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

	//given a region return the selected table region
	// + point:table start and node
	//assumes the selection start and end are within a table
	function tableSelection(selection) {
		var _selection = selection || editor.selection();
		var doc = editor.document();
		var _table = sym('table');
		var ret = [];
		_selection.forEachR(function(region) {
			var start = region.begin();
			var end = region.end();
			var ns = doc.nodesAt(start);
			var isTable = false;
			var nl;
			//find the table node.
			for (var i = ns.length - 1; i >= 0; i--) {
				nl = ns[i];
				if (nl.type === 'list' && nl.node.head() === _table)
					break;
			};
			if (i <= 0) return; //not a table node
			//check end point is also in node
			if (nl.node.size + nl.point < end) return;
			//find selected cells.
			var table = nl.node;
			var startCell = _table.cellAt(table, start - nl.point);
			var endCell = _table.cellAt(table, end - nl.point);
			var minCol = Math.min(startCell.column, endCell.column);
			var minRow = Math.min(startCell.row, endCell.row);
			var sAttr = startCell.node.attributes || {};
			var eAttr = endCell.node.attributes || {};
			var maxCol = Math.max(startCell.column + (sAttr.colSpan || 1) - 1,
				endCell.column + (eAttr.colSpan || 1) - 1);
			var maxRow = Math.max(startCell.row + (sAttr.rowSpan || 1) - 1,
				endCell.row + (eAttr.rowSpan || 1) - 1);
			//TODO adjust for col/rowspans in other cells.
			ret.push({node:nl.node, point:nl.point,
					start_row:minRow, start_col:minCol,
					end_row:maxRow, end_col:maxCol});
		});
		return ret;
	}

	function _move_cell(region, forward) {
		var r;
		if (forward)
			r = editor.moveTo(editor.move(
				editor.moveTo(region, 'hardeol'), 'characters', 1, true), 
				'hardeol',true);
		else
			r = editor.moveTo(editor.moveTo(editor.move(
				editor.moveTo(region, 'hardbol'), 'characters', 1, false), 
				'hardbol'),'hardeol',true);
		return r;
		//TODO: check if we are in the last cell or first cell etc.
	}

	function move_cell(args) {
		var forward = args.forward !== false;
		var selection = editor.selection();
		var regions = selection.regions;

		var ns = new Selection(regions.map(function(r) {
			return _move_cell(r, forward);
		}));

		editor.select(ns);
	};
	move_cell.description = function(args) {
		return "Select the contents of the next/previous cell."
	}


	function move(args) {
		console.log("table_move: " + JSON.stringify(args));
	}
	move.description = function(args) {
		return "Move within table";
	};

	function _moveTo(r, position, extend) {
		var doc = editor.document();
		var head = sym('table');
		var na = doc.nodesAt(r.focus);
		for (var i = na.length - 1; i >= 0; i--) {
			var nl = na[i];
			if (nl.type === 'list' && nl.node.head() === head) {
				switch (position) {
					case 'bot':
						return editor.move(
							new Region(nl.point, r.anchor),
							'characters',1,true, extend);
					case 'eot':
						return editor.move(
							new Region(nl.point + nl.node.size, r.anchor),
							'characters',1,false, extend);
					default:
						return r;
				};
			}
		};
		return r; //unmoved
	}

	function moveTo(args) {
		var position = args.position || 'bot';
		var extend = args.extend; //should extend selection
		var selection = editor.selection();
		var regions = selection.regions;

		console.log("table_move_to: " + JSON.stringify(args));

		var ns = new Selection(regions.map(function(r) {
			return _moveTo(r, position, extend);
		}));

		editor.select(ns);
	}
	moveTo.description = function(args) {
		return "Move to within table";
	};

	function _insert_rows(table, index, n) {
		var hr = table.values[1];
		var cols = 0;
		for (var i = hr.values.length - 1; i >= 1; i--) {
			var c = hr.values[i];
			if (c.attributes && c.attributes.colSpan)
				c += parseInt(c.attributes.colSpan);
			else
				c++;

		};

		return [];
	}

	function insert_row(args) {
		//insert whole row
		var ts = tableSelection();
		var before = args.before !== false;
		var ops = [];
		ts.forEach(function(t) {
			var index = (before ? t.start_row : t.end_row + 1);
			var op = [ot.operations.retain(t.point)];
			_insert_rows(t.node, index, 
				t.end_row - t.start_row + 1
				).forEach(function(o) {
					ot._push(op, o);
				});
			ops = ot.compose(ops, ot.transform(op,ops));
		});
		editor.apply(ops);
	}
	insert_row.description = function(description) {
		return "Insert row";
	};

	function _insert_cols(table, index, n) {
		var cell = ot.parse('(cell "")')[0];
		var cell_ops = cell.prefix(0,cell.size);
		var cells_ops = [];
		for (var i = 0; i < n; i++)
			cells_ops = cells_ops.concat(cell_ops);
		console.log(cells_ops);
		var ret = [ot.operations.retain(2)];
		for (var i = 1; i < table.values.length; i++) {
			var row = table.values[i];
			console.log(row)
			//retain to first cell
			ot._push(ret, ot.operations.retain(2));
			var retained = 2;
			for (var j = 1; j <= index; j++) {
				var _cell = row.values[j];
				console.log(_cell)
				ot._push(ret, ot.operations.retain(_cell.size));
				retained += _cell.size;
			}
			ret = ret.concat(cells_ops);
			//retain to end of row
			ot._push(ret, ot.operations.retain(row.size - retained));
		}
		return ret;
	}

	function insert_column(args) {
		//insert whole column
		var before = args.before !== false;
		var ts = tableSelection();
		var ops = [];
		ts.forEach(function(t) {
			var index = (before ? t.start_col : t.end_col + 1);
			var op = [ot.operations.retain(t.point)];
			_insert_cols(t.node, index, 
				t.end_col - t.start_col + 1
				).forEach(function(o) {
					ot._push(op, o);
				});
			ops = ot.compose(ops, ot.transform(op,ops));
		});
		console.log(ts);
		console.log(JSON.stringify(ops));
		editor.apply(ops);
	}
	insert_column.description = function(args) {
		return "Insert column";
	};

	function _delete(args) {
		//if column selected delete cells
		//if whole row selected delete rows
		//else clear cell content.
	}
	_delete.description = function(args) {
		return "Delete within table";
	};

	function _make_table(rows, columns, attributes) {
		var cell = '(cell "")'
		var _row = [];
		var i;
		for (i=0;i<columns;i++)
			_row.push(cell);
		var row = '(row ' + _row.join(' ') + ')';
		var _rows = [];
		for (i=0;i<rows;i++)
			_rows.push(row);
		var tbl = '(table ' + _rows.join(' ') + ')';
		if (attributes)
			tbl = JSON.stringify(attributes) + tbl;
		return ot.parse(tbl)[0];
	}

	function _insert_table(doc, region, args) {
		//insert table
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
			ops.push(ot.operations.pop);
			if (x.type === 'list') break;
		};
		//insert table here
		var tbl = _make_table(rows, cols, attributes);
		console.log(tbl.toSexpr());
		var x = tbl.prefix(0,tbl.size);
		console.log(x);
		ops = ops.concat(x);
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
	function insert_table(args) {
		var ops = bySelection(_insert_table, null, args);
		editor.apply(ops);
		//move to first cell
		var selection = editor.selection();
		var regions = selection.regions;

		var ns = new Selection(regions.map(function(r) {
			return _moveTo(editor.move(r,'characters',1,false), 'bot');
		}));

		editor.select(ns);
	}
	insert_table.description = function(args) {
		return "Insert table";
	};

	return {
		table_move: move,
		table_move_to: moveTo,
		table_move_cell: move_cell,
		insert_table: insert_table,
		insert_row: insert_row,
		insert_column: insert_column,
	};
}

var in_table_context = [{key:"head", operator:"equals", operand:"cell", match_all:true}];

var keymap = [
	{keys:["ctrl+k","b"], command:"table_move_to", args:{position:"bot"}},
	{keys:["ctrl+k","e"], command:"table_move_to", args:{position:"eot"}},
	{keys:["ctrl+k","a","b","up","down"], command:"table_move", args:{mode:"yay", forward:true}},
	{keys:["tab"], command:"table_move_cell", args:{forward:true}}, //, context:in_table_context},
	{keys:["shift+tab"], command:"table_move_cell", args:{forward:false}}, //, context:in_table_context},
	//{keys:["up"], command:"table_move", args:{mode:"row", forward:false}, context:in_table_context},
	//{keys:["down"], command:"table_move", args:{mode:"row", forward:true}, context:in_table_context},
	{keys:["alt+home"], command:"table_move_to", args:{mode:"bol"}, context:in_table_context},
	{keys:["cmd+i","c"], command:"insert_column", args:{before:true}, context:in_table_context},
	{keys:["cmd+i","r"], command:"insert_row", args:{before:true}, context:in_table_context},
	{keys:["cmd+i","shift+c"], command:"insert_column", args:{before:false}, context:in_table_context},
	{keys:["cmd+i","s"], command:"insert_row", args:{before:false}, context:in_table_context},
	{keys:["alt+i","t"], command:"insert_table", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
	{keys:["cmd+i","t"], command:"insert_table", args:{},
		context:[
			{key:"breakable", operator:"equals", operand:true, match_all:true}
		]},
];

var context_menu = [
	//insert table
	//insert col
	//insert row
	//etc.
];

module.exports = {
	commands: commands,
	keymap: keymap,
	menu: [],
	context_menu: context_menu,
};