import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const blogDataFile = path.resolve(rootDir, 'src/blogData.js');

function serializeBlogModule(data) {
    return `export const starData = ${JSON.stringify(data.starData, null, 4)};\n\nconst blogPosts = ${JSON.stringify(data.blogPosts, null, 4)};\n\nexport default blogPosts;\n`;
}

function blogDataPlugin() {
    return {
        name: 'blog-data-plugin',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (req.url === '/api/blogData' && req.method === 'GET') {
                    try {
                        const module = await server.ssrLoadModule('/src/blogData.js');
                        res.setHeader('Content-Type', 'application/json');
                        res.end(
                            JSON.stringify({
                                starData: module.starData,
                                blogPosts: module.default
                            })
                        );
                    } catch (error) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: error.message }));
                    }
                    return;
                }

                if (req.url === '/api/blogData' && req.method === 'POST') {
                    let body = '';
                    req.on('data', (chunk) => {
                        body += chunk.toString();
                    });
                    req.on('end', () => {
                        try {
                            const data = JSON.parse(body);
                            fs.writeFileSync(blogDataFile, serializeBlogModule(data));
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ success: true }));
                        } catch (error) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ success: false, error: error.message }));
                        }
                    });
                    return;
                }

                next();
            });
        }
    };
}

export default defineConfig({
    base: './',
    plugins: [blogDataPlugin()],
    server: {
        open: true
    },
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(rootDir, 'index.html'),
                editor: path.resolve(rootDir, 'editer/index.html')
            }
        }
    }
});
