import {defineConfig} from 'vite';
const isolationHeaders={'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'credentialless'};
export default defineConfig({
 worker:{format:'es'},
 server:{headers:isolationHeaders},
 preview:{headers:isolationHeaders}
});
