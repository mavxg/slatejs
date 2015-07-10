//Table commands.

function commands(editor) {
	function move(args) {
		console.log("table_move: " + JSON.stringify(args));
	}

	function moveTo(args) {
		console.log("table_move_to: " + JSON.stringify(args));
	}
	return {
		table_move: move,
		table_move_to: moveTo,
	};
}

var in_table_context = [{key:"head", operator:"equals", operand:"cell", match_all:true}];

var keymap = [
	{keys:["ctrl+k","a","b","up","down"], command:"table_move", args:{mode:"yay", forward:true}},
	{keys:["tab"], command:"table_move", args:{mode:"col", forward:true}, context:in_table_context},
	{keys:["shift+tab"], command:"table_move", args:{mode:"col", forward:false}, context:in_table_context},
	//{keys:["up"], command:"table_move", args:{mode:"row", forward:false}, context:in_table_context},
	//{keys:["down"], command:"table_move", args:{mode:"row", forward:true}, context:in_table_context},
	{keys:["alt+home"], command:"table_move_to", args:{mode:"bol"}, context:in_table_context},
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