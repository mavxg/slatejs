var dest = "./dist";
var _public = './public';

module.exports =  {
	browserSync: {
		server: {
			baseDir: [dest, _public]
		},
		files: [dest + "/**", "!" + dest + "/**.map", _public + "/**"]
	},
	browserify: {
		debug: true,
		bundleConfigs: [{
			entries: './slate.js',
			dest: dest,
			outputName: 'slate.js'
		}]
	}
}