import 'dotenv/config';
import { IMessageSDK } from '@photon-ai/imessage-kit';
import fs from 'fs';
import path from 'path';

const keyword = process.env.PDF_KEYWORD || 'pdf';
const defaultPdfPath = path.join(process.cwd(), 'sample.pdf');
const pdfFilePath = process.env.PDF_FILE_PATH || defaultPdfPath;

function fileExists(filePath) {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}

async function main() {
	if (!fileExists(pdfFilePath)) {
		console.warn(`PDF file not found at ${pdfFilePath}. Set PDF_FILE_PATH in your .env or place sample.pdf in project root.`);
	}

	const sdk = new IMessageSDK({
		debug: true,
		watcher: {
			pollInterval: 2000,
			unreadOnly: false,
			excludeOwnMessages: true
		}
	});

	await sdk.startWatching({
		onGroupMessage: async (message) => {
			const text = message?.text || '';
			if (!text) return;

			if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
				if (!fileExists(pdfFilePath)) {
					console.error('Cannot send PDF: file does not exist:', pdfFilePath);
					return;
				}
				try {
					await sdk.sendFile(message.chatId, pdfFilePath, 'Here is your PDF 📄');
					console.log(`Sent PDF to chat ${message.chatId}`);
				} catch (err) {
					console.error('Failed to send PDF:', err?.message || err);
				}
			}
		},
		onError: (error) => {
			console.error('Watcher error:', error);
		}
	});

	console.log('iMessage bot watching for group messages...');
	console.log(`Keyword: "${keyword}" | PDF path: ${pdfFilePath}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});


