import express from 'express';
import morgan from 'morgan';
import path from 'path';
import fsp from 'fs/promises';
import { run, uuid } from '../logic';
import { ensureLlmMdExists, ensureDataDirectoryExists } from './files';

ensureLlmMdExists();
ensureDataDirectoryExists();

const app = express();

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

app.get('/', (req, res) =>
	res.sendFile(path.resolve('./server/static/index.html'))
);
app.post('/analyze', async (req, res) => {
	const { username, password, nifiUrl, pgId, provenanceLimit } = req.body;
	const filePath = `data/${uuid()}.db`;

	try {
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
		});
		await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate async work

		setTimeout(() => {
			fsp.unlink(filePath)
				.catch(err => {
					console.error('Error deleting file:', err);
				})
				.then(() =>
					console.log(`File ${filePath} deleted successfully`)
				);
		}, 600000); // Delete after 10 minute

		res.json({
			path: filePath,
		});
	} catch (err) {
		console.error('Error during analysis:', err);
		res.status(500).json({ error: 'Internal server error' });
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
app.listen(port, '0.0.0.0', () =>
	console.log(`Listening on http://0.0.0.0:${port}`)
);


