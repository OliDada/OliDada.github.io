// Secure version - API calls go through your backend server

const businessInfo = `
General Information:
Website: www.olidada.github.io

General:
This is website called Oli.is, made by Oli. The pages on this website are:
home; there is a canvas to draw on, 
programs; where you can use various programs made by Oli, 
jokes; where you can press a button to see a funny joke,
snake game; where you can play the game snake,
magic 8 ball; where you can ask the magic 8 ball a question and get an answer,
AI Chat; where you can talk to an ai chat bot (happening now),
Change background color; where you can change the background color.
There are two images of dolphins at the top of the site

This website is still a work in progress and will be updated
`;

const messages = {
  history: []
};

async function sendMessage() {
    const messageInput = document.querySelector(".chat-window .input-area input");
    const chatWindow = document.querySelector(".chat-window .chat");

    if (messageInput.value.trim() === "") return;

    const userMessage = messageInput.value.trim();
    
    // Add user message to chat
    chatWindow.insertAdjacentHTML("beforeend", `
        <div class="user">
            <p>${userMessage}</p>
        </div>
    `);

    // Clear input
    messageInput.value = "";

    // Scroll to bottom
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        // Call your backend server instead of direct API
        const response = await fetch('/chat', {  // Use your deployed backend URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: userMessage + " Here's some info about this website: " + businessInfo, 
                history: messages.history 
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        // Add AI response to chat
        chatWindow.insertAdjacentHTML("beforeend", `
            <div class="model">
                <p>${data.reply}</p>
            </div>
        `);

        // Update history
        messages.history.push({ role: "user", parts: [{ text: userMessage }] });
        messages.history.push({ role: "model", parts: [{ text: data.reply }] });

        // Save to localStorage
        localStorage.setItem('chatHistory', JSON.stringify(messages));

        // Scroll to bottom
        chatWindow.scrollTop = chatWindow.scrollHeight;

    } catch (error) {
        console.error('Error:', error);
        chatWindow.insertAdjacentHTML("beforeend", `
            <div class="model">
                <p>Sorry, I'm having trouble connecting right now. Please try again later.</p>
            </div>
        `);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

function resetChat() {
    // Clear the message history
    messages.history = [];

    // Remove chat history from localStorage
    localStorage.removeItem('chatHistory');

    // Clear the chat window
    const chatWindow = document.querySelector(".chat-window .chat");
    chatWindow.innerHTML = '';

    // Add welcome message
    chatWindow.insertAdjacentHTML("beforeend", `
        <div class="model">
            <p>Hi, welcome to Oli.is. What's on your mind?</p>
        </div>
    `);
}

// Load saved chat history
window.addEventListener('load', () => {
    const savedMessages = localStorage.getItem('chatHistory');
    if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        messages.history = parsedMessages.history || [];
        
        const chatWindow = document.querySelector(".chat-window .chat");
        chatWindow.innerHTML = '';
        
        messages.history.forEach(msg => {
            const role = msg.role === 'user' ? 'user' : 'model';
            const text = msg.parts[0].text;
            chatWindow.insertAdjacentHTML("beforeend", `
                <div class="${role}">
                    <p>${text}</p>
                </div>
            `);
        });
        
        if (messages.history.length === 0) {
            chatWindow.insertAdjacentHTML("beforeend", `
                <div class="model">
                    <p>Hi, welcome to Oli.is. What's on your mind?</p>
                </div>
            `);
        }
    }
});

// Event listeners
document.querySelector(".chat-window .input-area button")
.addEventListener("click", ()=>sendMessage());

document.querySelector(".reset-chat")
.addEventListener("click", ()=>resetChat());

document.querySelector(".chat-window .input-area input")
.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});
