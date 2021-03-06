import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import { uglify } from 'rollup-plugin-uglify';
import { minify } from 'uglify-js';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',
  output: {
    name: 'SimpleWebRTCWrapper',
    file: 'dist/simpleWebRTCWrapper.min.js',
    sourcemap: true,
    format: 'umd',
    banner: '/** @preserve simpleWebRTCWrapper https://github.com/jimmaaay/simpleWebRTCWrapper */',
  },
  plugins: [
    resolve({
      main: true,
    }),
    commonjs({
      include: 'node_modules/**',
    }),
    typescript(),
    babel({
      exclude: 'node_modules/**' // only transpile our source code
    }),
    uglify({
      output: {
        comments: function(node, comment) {
          const { value, type } = comment;
          if (type == "comment2") {
              return /@preserve|@license|@cc_on/i.test(value);
          }
        }
      }
    }, minify),
  ], 
};