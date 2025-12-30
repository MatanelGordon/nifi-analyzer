import express from 'express';
import morgan from 'morgan';
import path from 'path';
import fsp from 'fs/promises';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { run, uuid, Events } from '../logic';
import { ensureLlmMdExists, ensureDataDirectoryExists } from './files';

ensureLlmMdExists();
ensureDataDirectoryExists();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});

// Password validation middleware
const validatePassword = (req: express.Request, res: express.Response, next: express.NextFunction) => {
	const { password } = req.query;
	const envPassword = process.env.PASSWORD ?? "1234";

	if(!password){
		res.status(400).json({ error: 'Missing password query parameter' });
		return;
	}

	if (!envPassword) {
		res.status(500).json({ error: 'Server password not configured' });
		return;
	}

	if (password !== envPassword) {
		res.status(401).json({ error: 'Invalid password' });
		return;
	}

	next();
};

app.use(morgan('tiny'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
	express.static(path.resolve('./src/server/static'), { index: 'index.html' })
);
app.use('/data', express.static(path.resolve('./data')));

// Socket.IO connection handler
io.on('connection', (socket) => {
	console.log('Client connected:', socket.id);

	socket.on('disconnect', () => {
		console.log('Client disconnected:', socket.id);
	});
});

app.get('/', (req, res) =>
	res.sendFile(path.resolve('./server/static/index.html'))
);
app.post('/analyze', async (req, res) => {
	const { username, password, nifiUrl, pgId, provenanceLimit, socketId } = req.body;
	const filePath = `data/${uuid()}.db`;

	try {
		// Create events object that emits to the specific socket
		const events: Events = {
			onMessage: (message) => {
				if (socketId) {
					io.to(socketId).emit('message', message.content);
				}
				console.log(message.content);
			},
			onSuccess: () => {
				if (socketId) {
					io.to(socketId).emit('success');
				}
			},
			onFail: (error) => {
				if (socketId) {
					io.to(socketId).emit('fail', { message: error.message, stack: error.stack });
				}
				console.error('Analysis error:', error);
			}
		};

		await run({
			nifiUsername: username,
			nifiPassword: password,
			nifiUrl,
			dbPath: filePath,
			pgId: pgId || 'root',
			noExit: true,
			provenance: {
				enabled: provenanceLimit > 0,
				maxResults: provenanceLimit || 100000,
			},
		}, events);
		await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate async work

		setTimeout(async () => {
			try {
				await fsp.access(filePath);
				await fsp.unlink(filePath);
				console.log(`File ${filePath} deleted successfully`);
			} catch (err) {
				// Only log if it's not a "file doesn't exist" error
				if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
					console.error('Error deleting file:', err);
				}
			}
		}, 600000); // Delete after 10 minute

		res.json({
			path: filePath,
		});
	} catch (err) {
		console.error('Error during analysis:', err);
		
		// Emit error through socket if socketId exists
		if (socketId) {
			const error = err instanceof Error ? err : new Error(String(err));
			io.to(socketId).emit('fail', { message: error.message, stack: error.stack });
		}
		
		res.status(500).json({ 
			error: 'Internal server error',
			message: err instanceof Error ? err.message : String(err)
		});
		return;
	}
});

app.post('/update-llm', express.text({ limit: '200mb' }), validatePassword, async (req, res) => {
	try {
		const content = req.body;
		
		if (!content || typeof content !== 'string') {
			res.status(400).json({ error: 'Invalid request body. Expected string content.' });
			return;
		}

		const llmMdPath = path.resolve('./src/server/static/llm.md');
		await fsp.writeFile(llmMdPath, content, 'utf-8');

		res.json({ success: true, message: 'llm.md updated successfully' });
	} catch (err) {
		console.error('Error updating llm.md:', err);
		res.status(500).json({ error: 'Failed to update llm.md' });
	}
});

const port = +(process.env.PORT || 3000);
httpServer.listen(port, '0.0.0.0', () =>
	console.log(`Listening on http://0.0.0.0:${port}`)
);


