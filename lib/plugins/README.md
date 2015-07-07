# Plugins

Inspired by the plugin architecture of Atom and SublimeText 3. Each plugin exposes (optionally) commands, keymap, menu, and context_menu as described below.

## commands

Commands is a function that creates a closure over editor and returns a dictionary of functions. Each function should also expose a description property (also a function) that describes the command for a given set of arguments. Note, the key within the dictionary should be prefixed such that it is globally unique (commands exist in a flat namespace).

Each function should take zero or one arguments. For multiple arguments command functions should accept a dictionary or array.


## keymap

Array of objects representing a mapping from a sequence of keypresses (and associated context) to a command and arguments.

### keys

The `keys` property is an array of one or more key chords to be pressed in sequence to trigger the given action.

### command

Name of the command to be run.

### args

Passed to the command as first (and only) argument.

### context

Array of context object specifying if the shortcut can be used given the current environment.

# Example

    function commands(editor) {
    	function yell(args) {
    		console.log(args.message || "Yo, what up?");
    	}
    	yell.description = function(args) {
    		var message = args.message || "Yo, what up?";
    		return "Logs '" + message +"' to the console.";
    	};

    	return {
    		nutty_yell: yell
    	};
    }

    var keymap = [
        {keys:["ctrl-k","y"], command:"nutty_yell", args:{message:"Yo dude!"}},
    ];

    module.exports = {
    	commands: commands,
    	keymap: keymap,
    };