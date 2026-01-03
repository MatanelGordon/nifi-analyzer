/**
 * Terminal module for displaying real-time analysis events
 * Uses Socket.IO to receive events from the server
 */

let socket = null;
let isConnected = false;
let terminalOutput = null;
let terminalContainer = null;

/**
 * Initialize terminal UI elements
 */
function initTerminalUI() {
	terminalOutput = document.getElementById('terminal-output');
	terminalContainer = document.getElementById('terminal-container');
	
	const toggleBtn = document.getElementById('terminal-toggle-btn');
	const closeBtn = document.getElementById('terminal-close-btn');
	
	// Toggle terminal visibility
	toggleBtn.addEventListener('click', () => {
		terminalContainer.classList.toggle('visible');
	});
	
	// Close terminal
	closeBtn.addEventListener('click', () => {
		terminalContainer.classList.remove('visible');
	});
}

/**
 * Create a log entry span element with appropriate styling
 * @param {string} message - Message to display
 * @param {string} type - Message type (info, success, error)
 * @returns {HTMLSpanElement} Styled span element
 */
function createLogEntry(message, type = 'info') {
	const timestamp = new Date().toLocaleTimeString();
	const prefix = type === 'error' ? '[ERROR]' : type === 'success' ? '[SUCCESS]' : '[INFO]';
	const line = `[${timestamp}] ${prefix} ${message}`;
	
	const lineElement = document.createElement('span');
	lineElement.textContent = line + '\n';
	
	if (type === 'error') {
		lineElement.classList.add('error');
	} else if (type === 'success') {
		lineElement.classList.add('success');
	}
	
	return lineElement;
}

/**
 * Append a message to the terminal
 * @param {string} message - Message to display
 * @param {string} type - Message type (info, success, error)
 */
function appendToTerminal(message, type = 'info') {
	if (!terminalOutput) return;
	
	const lineElement = createLogEntry(message, type);
	terminalOutput.appendChild(lineElement);
	
	// Auto-scroll to bottom
	terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

/**
 * Clear terminal output
 */
function clearTerminal() {
	if (terminalOutput) {
		terminalOutput.textContent = '';
	}
}

/**
 * Show terminal
 */
function showTerminal() {
	if (terminalContainer) {
		terminalContainer.classList.add('visible');
	}
}

/**
 * Hide terminal
 */
function hideTerminal() {
	if (terminalContainer) {
		terminalContainer.classList.remove('visible');
	}
}

/**
 * Initialize socket connection and set up event listeners
 * @returns {string} Socket ID for the connection
 */
function connectToSocket() {
	if (isConnected && socket) {
		console.log('Socket already connected');
		return socket.id;
	}

	// Initialize Socket.IO connection
	socket = io();

	// Connection established
	socket.on('connect', () => {
		isConnected = true;
		console.log('Socket connected:', socket.id);
		appendToTerminal('Connected to server', 'success');
	});

	// Handle disconnection
	socket.on('disconnect', () => {
		isConnected = false;
		console.log('Socket disconnected');
		appendToTerminal('Disconnected from server', 'error');
	});

	// Handle message events
	socket.on('message', (content) => {
		console.log('[MESSAGE]', content);
		appendToTerminal(content, 'info');
	});

	// Handle success events
	socket.on('success', () => {
		console.log('[SUCCESS] Analysis completed successfully');
		appendToTerminal('Analysis completed successfully', 'success');
	});

	// Handle failure events
	socket.on('fail', (error) => {
		console.error('[FAIL]', error.message);
		appendToTerminal(error.message, 'error');
		if (error.stack) {
			console.error('Stack trace:', error.stack);
		}
	});

	// Handle connection errors
	socket.on('connect_error', (error) => {
		console.error('Connection error:', error);
		appendToTerminal('Connection error: ' + error.message, 'error');
		isConnected = false;
	});

	return socket.id;
}

/**
 * Disconnect from socket
 */
function disconnectSocket() {
	if (socket) {
		socket.disconnect();
		socket = null;
		isConnected = false;
		console.log('Socket disconnected manually');
		appendToTerminal('Disconnected manually', 'info');
	}
}

/**
 * Get the current socket ID
 * @returns {string|null} Socket ID or null if not connected
 */
function getSocketId() {
	return socket?.id || null;
}

/**
 * Check if socket is connected
 * @returns {boolean} Connection status
 */
function isSocketConnected() {
	return isConnected;
}

// Initialize UI when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initTerminalUI);
} else {
	initTerminalUI();
}

// Export functions for use in other scripts
window.Terminal = {
	connectToSocket,
	disconnectSocket,
	getSocketId,
	isSocketConnected,
	appendToTerminal,
	clearTerminal,
	showTerminal,
	hideTerminal
};
