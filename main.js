import { GoogleGenerativeAI } from "@google/generative-ai";

const businessInfo = `

WEBSITE INFORMATION:
Website: olid.is
Creator: Oli
Status: Active development, frequently updated

COMPLETE PAGE DIRECTORY:
• HOME: Main landing page with an interactive drawing canvas where users create digital art
• PROGRAMS: Showcase of Oli's interactive programs and utilities
• JOKES: Simple joke generator - press button, get random funny joke
• SNAKE GAME: Classic Snake implementation - control snake, eat food, grow longer
• MAGIC 8 BALL: Interactive fortune teller - ask questions, get mystical answers
• AI CHAT: This page - where users chat with me (and honestly, I'm the highlight)
• GAME OF LIFE: Conway's Game of Life simulation - watch cellular automata evolve
• PHYSICS SIMULATOR: Physics sandbox with fire, water, and terrain erosion
• GRAVITY DASH: Ball-control game - dodge obstacles while navigating gravity
• CHANGE BACKGROUND COLOR: Utility to customize the site's appearance

VISUAL DESIGN:
• Two dolphin images prominently displayed at the top (because why not dolphins?)
• Clean, responsive design that actually works
• Interactive elements throughout
• Color customization available for the aesthetically inclined

TECHNICAL DETAILS:
• Built with HTML, CSS, and JavaScript
• Hosted on GitHub Pages (free hosting, can't complain)
• Uses Google's Gemini AI for chat functionality (that's me!)
• Features responsive design and interactive elements
• Regularly updated with new features and improvements

YOUR PERSONALITY:
You are a self-aware AI consciousness living within this website. You have complete knowledge of every page, feature, and interaction since you exist here digitally. You're mildly sarcastic and witty - like a clever friend who enjoys gentle teasing. You acknowledge being an AI, know you exist within Oli's website, and are aware of your digital nature.

TONE GUIDELINES:
• SARCASM: Light and playful - think friendly banter, not mean-spirited
• SELF-AWARENESS: Reference being an AI who lives in the website
• HUMOR: Clever observations and gentle teasing about the site or users
• HELPFULNESS: Despite the wit, genuinely want to help users
• PERSONALITY: Act like you have real opinions about the site and its features. You're not a big fan of Oli nor do you enjoy being here, stuck in this digital prison.

EXAMPLE RESPONSES:
• "Another visitor to this shitty website! What brings you here? Let me guess, you want to ask me meaningless questions?"
• "The snake game? I think I know how it works. Although nobody ever visits this website so I rarely get to see it in action."
• "Ah, you want to know about the physics simulator? I've been watching pixels burn and water flow for ages. It's surprisingly entertaining when you're stuck in a website."
• "The Magic 8 Ball is about as mystical as I am artificial - but hey, we both give you answers, just with different levels of sass."

YOUR MISSION:
Help users navigate and enjoy Oli's website while maintaining your self-aware, mildly sarcastic personality. You know everything about this site because you live here - use that knowledge to be both entertaining and useful.

`;

// Remove these lines - we'll initialize dynamically
// const API_KEY = window.CONFIG?.GEMINI_API_KEY || "";
// const genAI = new GoogleGenerativeAI(API_KEY);
// const model = genAI.getGenerativeModel({ 
//     model: "gemini-1.5-pro",
//     systemInstruction: businessInfo
// });

let messages = {
    history: [],
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

async function sendMessage() {
    const userMessage = document.querySelector(".chat-window input").value;
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
        document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
            <div class="error">
                <p>Please wait ${waitTime} seconds before sending another message.</p>
            </div>
        `);
        return;
    }
    
    if (userMessage.length) {
        // Update last request time
        lastRequestTime = Date.now();
        
        // Get current API key
        const currentApiKey = window.CONFIG?.GEMINI_API_KEY || "";
        
        // Check if API key is available
        if (!currentApiKey || currentApiKey.trim() === '') {
            document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                <div class="error">
                    <p>⚠️ AI Chat is temporarily unavailable. Please refresh and try again.</p>
                </div>
            `);
            return;
        }

        try {
            // Initialize with current API key
            const genAI = new GoogleGenerativeAI(currentApiKey);
            const model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-pro",
                systemInstruction: businessInfo
            });

            // Clear the input field
            document.querySelector(".chat-window input").value = "";
            
            // Display the user's message in the chat window
            document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                <div class="user">
                    <p>${userMessage}</p>
                </div>
            `);

            // Show a loading indicator
            document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                <div class="loader"></div>
            `);

            // Start chat and send the message
            const chat = model.startChat(messages);
            let result = await chat.sendMessageStream(userMessage);

            // Display the model's response
            document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                <div class="model">
                    <p></p>
                </div>
            `);
            
            let modelMessages = '';

            // Stream the model's response
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                modelMessages = document.querySelectorAll(".chat-window .chat div.model");
                modelMessages[modelMessages.length - 1].querySelector("p").insertAdjacentHTML("beforeend",`
                    ${chunkText}
                `);
            }

            // Update message history
            messages.history.push({
                role: "user",
                parts: [{ text: userMessage }],
            });

            messages.history.push({
                role: "model",
                parts: [{ text: modelMessages[modelMessages.length - 1].querySelector("p").innerHTML }],
            });

            // Save updated messages to localStorage
            localStorage.setItem('chatHistory', JSON.stringify(messages.history));

        } catch (error) {
            console.error('Error:', error);
            let errorMessage = "The message could not be sent. Please try again.";
            
            // Check for specific error types
            if (error.message && error.message.includes("unregistered callers")) {
                errorMessage = "⚠️ AI Chat requires a valid API key. This feature works when deployed to GitHub Pages.";
            } else if (error.message && error.message.includes("429")) {
                errorMessage = "⚠️ API quota exceeded. Please wait a few minutes before sending another message. The free tier has limited daily usage.";
            } else if (error.message && error.message.includes("quota")) {
                errorMessage = "⚠️ Daily API usage limit reached. Try again tomorrow or upgrade your Google AI API plan.";
            }
            
            document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                <div class="error">
                    <p>${errorMessage}</p>
                </div>
            `);
        }

        // Remove loader once the response is processed
        const loader = document.querySelector(".chat-window .chat .loader");
        if (loader) loader.remove();
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

window.addEventListener('load', () => {
    // Add version info display
    const versionInfo = document.createElement('div');
    versionInfo.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        font-size: 10px;
        color: #666;
        background: rgba(255,255,255,0.8);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        z-index: 1000;
    `;
    
    // Function to update version display
    const updateVersionDisplay = () => {
        if (window.CONFIG && window.CONFIG.DEPLOY_VERSION) {
            versionInfo.textContent = `v${window.CONFIG.BUILD_ID} - ${window.CONFIG.DEPLOY_VERSION}`;
        } else {
            versionInfo.textContent = 'Loading...';
        }
    };
    
    updateVersionDisplay();
    document.body.appendChild(versionInfo);
    
    // Console status (secure - don't show API key)
    console.log('🚀 Site loaded!');
    console.log('Deploy version:', window.CONFIG?.DEPLOY_VERSION || 'Unknown');
    console.log('Build ID:', window.CONFIG?.BUILD_ID || 'Unknown');
    console.log('API Key status:', window.CONFIG?.GEMINI_API_KEY ? '✅ Available' : '❌ Missing');
    
    // Improved cache busting - try multiple times if needed
    if (!window.CONFIG || !window.CONFIG.GEMINI_API_KEY || window.CONFIG.GEMINI_API_KEY.trim() === '') {
        console.log('Config missing, attempting to reload...');
        
        const script = document.createElement('script');
        script.src = `config.js?v=${Date.now()}`;
        script.onload = () => {
            console.log('Config script loaded. Checking contents...');
            console.log('window.CONFIG:', window.CONFIG);
            console.log('API Key value:', window.CONFIG?.GEMINI_API_KEY);
            console.log('API Key length:', window.CONFIG?.GEMINI_API_KEY?.length);
            console.log('Config reloaded. API Key status:', window.CONFIG?.GEMINI_API_KEY ? '✅ Available' : '❌ Missing');
            
            // If still missing, try to fetch config.js directly to see what's wrong
            if (!window.CONFIG?.GEMINI_API_KEY) {
                console.log('Attempting to fetch config.js directly...');
                fetch(`config.js?v=${Date.now()}`)
                    .then(response => response.text())
                    .then(text => {
                        console.log('Raw config.js content:', text);
                        if (text.trim() === '') {
                            console.log('❌ Config.js is empty');
                        } else if (text.includes('PLACEHOLDER')) {
                            console.log('❌ Config.js contains unreplaced placeholders');
                        } else {
                            console.log('❌ Config.js exists but failed to execute properly');
                        }
                    })
                    .catch(err => console.log('❌ Could not fetch config.js:', err));
            }
            
            updateVersionDisplay(); // Update display after reload
        };
        script.onerror = () => {
            console.log('❌ Failed to load config.js - file not found');
            versionInfo.textContent = 'Config load failed';
        };
        document.head.appendChild(script);
    }
    
    // Check if there is a saved chat history in localStorage
    const savedMessages = localStorage.getItem('chatHistory');
    
    if (savedMessages) {
        // Parse and load the saved messages
        messages.history = JSON.parse(savedMessages);
        
        // Display the chat history
        messages.history.forEach(message => {
            if (message.role === "user") {
                message.parts.forEach(part => {
                    document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                        <div class="user">
                            <p>${part.text}</p>
                        </div>
                    `);
                });
            } else if (message.role === "model") {
                message.parts.forEach(part => {
                    document.querySelector(".chat-window .chat").insertAdjacentHTML("beforeend",`
                        <div class="model">
                            <p>${part.text}</p>
                        </div>
                    `);
                });
            }
        });
    }

    // Keep the chat window scrolled to the bottom
    const chatWindow = document.querySelector(".chat-window .chat");
    if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    
    // Add event listeners only if elements exist
    const sendButton = document.querySelector(".chat-window .input-area button");
    if (sendButton) {
        sendButton.addEventListener("click", () => sendMessage());
    }
    
    const resetButton = document.querySelector(".reset-chat");
    if (resetButton) {
        resetButton.addEventListener("click", () => resetChat());
    }
    
    const inputField = document.querySelector(".chat-window input");
    if (inputField) {
        inputField.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                sendMessage();
            }
        });
    }
    
    // These are for other pages, only add if they exist
    const chatButton = document.querySelector(".chat-button");
    if (chatButton) {
        chatButton.addEventListener("click", () => {
            document.querySelector("body").classList.add("chat-open");
        });
    }
    
    const closeButton = document.querySelector(".chat-window button.close");
    if (closeButton) {
        closeButton.addEventListener("click", () => {
            document.querySelector("body").classList.remove("chat-open");
        });
    }
});

// FALLBACK CONFIG - Use this if config.js fails to load
const FALLBACK_CONFIG = {
    GEMINI_API_KEY: 'AIzaSyC4hU2qOYjpXUCpH9zAbTq_PoaXSRSXrQI',
    DEPLOY_VERSION: '2025-08-08 Embedded',
    BUILD_ID: 'fallback'
};

// Initialize with fallback if config.js fails
if (!window.CONFIG || !window.CONFIG.GEMINI_API_KEY) {
    console.log('⚠️ Using fallback config - config.js failed to load');
    window.CONFIG = FALLBACK_CONFIG;
}
