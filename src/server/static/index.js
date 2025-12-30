const OUTPUT = document.getElementById("output");
const ANALYZE_BUTTON = document.getElementById('analyze');
const GET_FILE_BUTTON = document.getElementById('get-file');

initializeFields();
document
	.getElementById('analyze-form')
	.addEventListener('submit', onSubmitForm);


async function runScript(nifiUrl, username, password, pgId, provenanceLimit) {
    try{
        startButtonLoader();
        
        // Clear terminal and show it
        window.Terminal.clearTerminal();
        window.Terminal.showTerminal();
        
        // Connect to socket and get socket ID
        const socketId = window.Terminal.connectToSocket();
        
        // Wait a bit for socket to connect if it's a new connection
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const res = await fetch('/analyze', {
			method: 'POST',
			body: JSON.stringify({ 
				nifiUrl, 
				username, 
				password, 
				pgId, 
				provenanceLimit,
				socketId: window.Terminal.getSocketId() 
			}),
			headers: { 'Content-Type': 'application/json' },
		});
        const json = await res.json();
        outputSuccess("Script executed successfully.");
        setGetFileButtonVisible(json.path);
    }
    catch(err){
        outputError(`Script error: ${err.message}`);
        setGetFileButtonHidden();
    }
    finally{
        stopButtonLoader();
    }
}

function downloadFile(){

}

async function onSubmitForm(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get('username');
    const password = formData.get('password');
    const nifiUrl = formData.get('url');
    let pgid = formData.get('pgid');
    const provenanceLimit = parseInt(formData.get('provenanceLimit')) || 100000;

    if(pgid.trim() === ''){
        pgid = null;
    }

    await runScript(nifiUrl, username, password, pgid, provenanceLimit);
}

function outputError(message){
    OUTPUT.textContent = message;
    OUTPUT.classList.remove("success", "error");
    OUTPUT.classList.add("error");
}

function outputSuccess(message) {
	OUTPUT.textContent = message;
	OUTPUT.classList.remove('success', 'error');
	OUTPUT.classList.add('success');
}

function startButtonLoader(){
    ANALYZE_BUTTON.setAttribute("disabled", "true");
    ANALYZE_BUTTON.textContent = "Loading...";
}

function stopButtonLoader(){
    ANALYZE_BUTTON.removeAttribute('disabled');
    ANALYZE_BUTTON.textContent = "Analyze";
}

function setGetFileButtonVisible(downloadPath){
    GET_FILE_BUTTON.style.display = 'flex';
    GET_FILE_BUTTON.href = downloadPath;
}

function setGetFileButtonHidden(){
    GET_FILE_BUTTON.style.display = 'none';
    GET_FILE_BUTTON.href = '';
}

function initializeFields(){
    document.querySelectorAll('.field').forEach(field => {
        const input = field.querySelector('.field__input');

        input.addEventListener('change', () => {
            if(input.value.trim() !== ''){
                field.classList.add('active');
            }
            else{
                field.classList.remove('active');
            }
        });
    });
}