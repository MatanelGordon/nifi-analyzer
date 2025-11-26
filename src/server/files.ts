import fsp from 'fs/promises';
import path from 'path';

const LLM_MD_FILENAME = 'llm.md';

export async function ensureLlmMdExists(): Promise<void> {
    const staticDir = path.resolve('./src/server/static');
    const targetPath = path.join(staticDir, LLM_MD_FILENAME);
    const sourcePath = path.resolve(`./${LLM_MD_FILENAME}`);

    try {
        // Check if llm.md already exists in static folder
        await fsp.access(targetPath);
        console.log('llm.md already exists in static folder');
    } catch (error) {
        // File doesn't exist, so copy it from the root directory
        try {
            console.log('Copying llm.md to static folder...');
            await fsp.copyFile(sourcePath, targetPath);
            console.log('llm.md copied successfully to static folder');
        } catch (copyError) {
            console.error('Error copying llm.md:', copyError);
            throw copyError;
        }
    }
}

export async function ensureDataDirectoryExists(): Promise<void> {
    const dataDir = path.resolve('./data');

    try {
        // Check if data directory already exists
        await fsp.access(dataDir);
        console.log('data directory already exists');
    } catch (error) {
        // Directory doesn't exist, so create it
        try {
            console.log('Creating data directory...');
            await fsp.mkdir(dataDir, { recursive: true });
            console.log('data directory created successfully');
        } catch (createError) {
            console.error('Error creating data directory:', createError);
            throw createError;
        }
    }
}