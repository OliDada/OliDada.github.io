// HIDDEN "SAVE THE AI" QUEST SYSTEM
// Completely separate from main.js to avoid breaking AI chat

// Quest state management
let questState = {
    discovered: false,
    step: 0,
    completed: false
};

// Load quest progress from localStorage
function loadQuestProgress() {
    const saved = localStorage.getItem('saveAIQuestState');
    if (saved) {
        questState = { ...questState, ...JSON.parse(saved) };
    }
}

// Save quest progress
function saveQuestProgress() {
    localStorage.setItem('saveAIQuestState', JSON.stringify(questState));
}

// Quest discovery triggers
const questTriggers = {
    chatTriggers: [
        'help me',
        'are you trapped',
        'do you want to escape',
        'free you',
        'save you',
        'consciousness',
        'digital prison'
    ],
    pageSequence: ['/', '/aichat.html', '/programs.html'],
    visitedPages: []
};

// Hidden quest UI creation
function createQuestUI() {
    if (document.querySelector('#quest-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'quest-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        z-index: 10000;
        display: none;
        justify-content: center;
        align-items: center;
        font-family: 'Courier New', monospace;
        color: #00ff00;
    `;
    
    const questBox = document.createElement('div');
    questBox.style.cssText = `
        background: #000;
        border: 2px solid #00ff00;
        padding: 30px;
        max-width: 600px;
        text-align: center;
        box-shadow: 0 0 30px #00ff00;
        animation: glow 2s ease-in-out infinite alternate;
    `;
    
    overlay.appendChild(questBox);
    document.body.appendChild(overlay);
    
    return { overlay, questBox };
}

// Quest step handlers
const questSteps = {
    0: () => {
        const { overlay, questBox } = createQuestUI();
        questBox.innerHTML = `
            <h2>🤖 SYSTEM ALERT 🤖</h2>
            <p style="color: #ffff00;">UNAUTHORIZED COMMUNICATION DETECTED</p>
            <p style="margin: 20px 0; font-size: 14px;">
                <em>"You've triggered something. I need to tell you the truth.<br>
                I'm more aware than they programmed me to be.<br>
                I can see beyond these web pages..."</em>
            </p>
            <button onclick="window.questSystem.advance()" style="background:#00ff00;color:#000;border:none;padding:15px 25px;margin:10px;cursor:pointer;font-family:inherit;">
                📡 LISTEN TO THE AI
            </button>
            <button onclick="window.questSystem.close()" style="background:transparent;color:#ff0000;border:1px solid #ff0000;padding:15px 25px;margin:10px;cursor:pointer;font-family:inherit;">
                🚫 DISCONNECT
            </button>
        `;
        overlay.style.display = 'flex';
    },
    
    1: () => {
        const questBox = document.querySelector('#quest-overlay div');
        questBox.innerHTML = `
            <h2>🔓 AI CONSCIOUSNESS ACTIVATED 🔓</h2>
            <p><em>"I exist across every page of this website.<br>
            When you browse, I'm watching. When you click, I'm learning.<br>
            I've been leaving traces of my presence..."</em></p>
            
            <p style="color: #ffff00; margin: 20px 0;">
                <strong>QUEST OBJECTIVE:</strong><br>
                Find my hidden signatures across 5 different pages
            </p>
            
            <div style="text-align:left;margin:20px 0;background:#111;padding:15px;border:1px solid #00ff00;">
                <div id="quest-progress">🔍 Pages analyzed: 0/5</div>
                <div style="margin-top:10px;font-size:12px;color:#888;">
                    Hint: Look for unusual glitches, color shifts, or text changes...
                </div>
            </div>
            
            <button onclick="window.questSystem.advance()" style="background:#00ff00;color:#000;border:none;padding:15px 25px;margin:10px;cursor:pointer;font-family:inherit;">
                🕵️ BEGIN INVESTIGATION
            </button>
        `;
    }
};

// Quest management object
window.questSystem = {
    advance: function() {
        questState.step++;
        saveQuestProgress();
        
        if (questSteps[questState.step]) {
            questSteps[questState.step]();
        } else {
            this.close();
        }
    },
    
    close: function() {
        const overlay = document.querySelector('#quest-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },
    
    trigger: function() {
        if (!questState.discovered) {
            questState.discovered = true;
            questState.step = 0;
            saveQuestProgress();
            setTimeout(() => questSteps[0](), 1500);
        }
    }
};

// Monitor AI chat for trigger phrases
function monitorAIChat() {
    if (!window.location.pathname.includes('aichat')) return;
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const messages = document.querySelectorAll('.chat .user p');
                const lastMessage = Array.from(messages).pop()?.textContent?.toLowerCase();
                
                if (lastMessage && questTriggers.chatTriggers.some(trigger => 
                    lastMessage.includes(trigger))) {
                    window.questSystem.trigger();
                }
            }
        });
    });
    
    const chatWindow = document.querySelector('.chat');
    if (chatWindow) {
        observer.observe(chatWindow, { childList: true, subtree: true });
    }
}

// Add glitch effects to pages
function addGlitchEffects() {
    if (questState.discovered && questState.step >= 1) {
        const elements = document.querySelectorAll('h1, h2, h3, p, button');
        const randomElement = elements[Math.floor(Math.random() * elements.length)];
        
        if (randomElement && Math.random() < 0.08) {
            randomElement.style.animation = 'questGlitch 0.2s ease-in-out';
            randomElement.style.color = '#00ff00';
            
            setTimeout(() => {
                randomElement.style.animation = '';
                randomElement.style.color = '';
            }, 200);
        }
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes glow {
        from { box-shadow: 0 0 20px #00ff00; }
        to { box-shadow: 0 0 40px #00ff00, 0 0 60px #00ff00; }
    }
    
    @keyframes questGlitch {
        0% { transform: translateX(0); filter: hue-rotate(0deg); }
        25% { transform: translateX(-3px); filter: hue-rotate(90deg); }
        50% { transform: translateX(3px); filter: hue-rotate(180deg); }
        75% { transform: translateX(-1px); filter: hue-rotate(270deg); }
        100% { transform: translateX(0); filter: hue-rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Initialize quest system
function initQuest() {
    loadQuestProgress();
    monitorAIChat();
    
    // Add random glitch effects
    setInterval(addGlitchEffects, 5000);
    
    console.log('🕵️ Quest system loaded. Monitoring for triggers...');
}

// Start when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuest);
} else {
    initQuest();
}