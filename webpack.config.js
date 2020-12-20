const Path = require('path');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    "mode": "development",
    //"entry": "src/index.js",
    "output": {
        "path": __dirname,
        "filename": "[name].[chunkhash:8].js",
        "library": "vue/__webpack_basename__",
        "libraryTarget": "amd",
        devtoolModuleFilenameTemplate: info => {
            let resPath = Path.normalize(info.resourcePath);
            let isVue = resPath.match(/\.vue$/);
            let isGenerated = info.allLoaders;

            if(isVue && isGenerated) {
                const stripHtml = resPath.match(/^html[\\\/](.+)$/);
                if(stripHtml) resPath = stripHtml[1];
                return 'webpack-generated:///' + resPath + '?' + info.hash;
            }
    
            let htmlPrefix = resPath.match(/^html([\\\/].+)$/);
            if(htmlPrefix) {
                return '..' + htmlPrefix[1];
            }

            return 'webpack-vue-source:///' + resPath;
        },    
        devtoolFallbackModuleFilenameTemplate: 'webpack:///[resource-path]?[hash]', 
    },
    "module": {
        "rules": [
            /*{
                "enforce": "pre",
                "test": /\.(js|jsx)$/,
                "exclude": /node_modules/,
                "use": "eslint-loader"
            },
            {
                "test": /\.tsx?$/,
                "exclude": /node_modules/,
                "use": {
                    "loader": "ts-loader",
                    "options": {
                        "transpileOnly": true
                    }
                }
            },*/
            {
                test: /\.css$/,
                use: [
                    'vue-style-loader',
                    {
                        loader:'css-loader',
                        options: {
                            sourceMap: false,
                            url: false,
                        }
                    }
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    'vue-style-loader',
                    {
                        loader:'css-loader',
                        options: {
                            sourceMap: false,
                            url: false,
                        }
                    },
                    'sass-loader'
                ]
            },
            {
                test: /\.sass$/,
                use: [
                    'vue-style-loader',
                    {
                        loader:'css-loader',
                        options: {
                            sourceMap: false,
                            url: false,
                        }
                    },
                    {
                        loader:'sass-loader',
                        options: {
                            indentedSyntax: true,
                            sassOptions: {
                                indentedSyntax: true
                            }
                        }
                    }
                ]
            },
            {
                test: /\.vue$/,
                //include: Path.resolve(__dirname, '/html/vue'),
                exclude: /node_modules/,
                use: [
                    {
                        loader: "vue-loader",
                        options: {
                            transformAssetUrls: {
                                img: [],
                            }
                        }
                    }
                ]
            },
            {
                test: /\.js$/,
                use: {
                    loader:'babel-loader',
                    options: {
                        presets: [
                            [
                                "@babel/preset-env",
                                { targets: { ie: "11" } }
                            ]
                        ]
                    }
                },
                exclude: /node_modules/
            }
        ]
    },
    "stats": {
        "errorDetails":true,
//        "errorStack":true,
        "logging":"verbose"
    },
    devtool: "inline-source-map",
    plugins: [
        new VueLoaderPlugin()
    ],
    "optimization": {
        "minimize": true,
        "minimizer": [
            new TerserPlugin({
                "extractComments": false
            })
        ]
    }
}