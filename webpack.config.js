
module.exports = {
    entry: [
        'webpack/hot/only-dev-server',
        "./entry.js"
    ],
    output: {
        path: __dirname + '/public',
        filename: "bundle.js"
    },
    module: {
        loaders: [
            { test: /\.js$/, exclude: /node_modules/, loaders: ['babel'] },
            { test: /\.css$/, loader: 'style!css?sourceMap' },
        ]
    }
};