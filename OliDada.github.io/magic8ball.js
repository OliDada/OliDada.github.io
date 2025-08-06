// Array of possible Magic 8-Ball answers
const answers = [
    "Yes, definitely.",
    "It is certain.",
    "Without a doubt.",
    "Reply hazy, try again.",
    "Ask again later.",
    "Better not tell you now.",
    "Don't count on it.",
    "My sources say no.",
    "Very doubtful."
];

// Function to get a random answer
function getAnswer() {
    const question = document.getElementById("questionInput").value.trim();
    const responseDiv = document.getElementById("response");

    if (!question) {
        responseDiv.textContent = "You need to ask a question!";
        return;
    }

    // Generate a random answer
    const randomIndex = Math.floor(Math.random() * answers.length);
    const randomAnswer = answers[randomIndex];

    // Display the answer
    responseDiv.textContent = randomAnswer;

    // Clear the question input
    document.getElementById("questionInput").value = "";
}
