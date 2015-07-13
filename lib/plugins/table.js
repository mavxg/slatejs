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

	function insert_row(args) {
		//insert whole row
	}
	insert_row.description = function(description) {
		return "Insert row";
	};

	function insert_column(args) {
		//insert whole column
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