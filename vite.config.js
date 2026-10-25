import {defineConfig} from 'vite';
const isolationHeaders={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'};
export default defineConfig({
 worker:{format:'es'},
 optimizeDeps:{exclude:['@moonshine-ai/moonshine-wasm']},
 server:{headers:isolationHeaders},
 preview:{headers:isolationHeaders}
});
