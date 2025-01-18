const originalBackground = "images/1.jpg";

function changeBackgroundColor() {
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

    // Set the random color as the background and remove the image
    document.body.style.backgroundColor = randomColor;
    document.body.style.backgroundImage = "none";

    // Save the new background settings to localStorage
    localStorage.setItem("backgroundColor", randomColor);
    localStorage.setItem("backgroundImage", "none");
}

function revertToOriginalBackground() {
    // Reset to the original background image
    document.body.style.backgroundColor = ""; // Clear any set background color
    document.body.style.backgroundImage = `url('${originalBackground}')`;

    // Save the original background settings to localStorage
    localStorage.setItem("backgroundColor", "");
    localStorage.setItem("backgroundImage", `url('${originalBackground}')`);
}

function applySavedBackground() {
    // Retrieve saved background settings from localStorage
    const savedColor = localStorage.getItem("backgroundColor");
    const savedImage = localStorage.getItem("backgroundImage");

    // Apply the saved background, or default to the original
    document.body.style.backgroundColor = savedColor || "";
    document.body.style.backgroundImage = savedImage || `url('${originalBackground}')`;
}

// Apply the saved background when the page loads
applySavedBackground();

const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
let painting = false;
let brushColor = "#000000"; // Default brush color is black
let brushSize = 5;
let lastX = 0;
let lastY = 0;

// Event listeners for mouse events on the canvas
canvas.addEventListener("mousedown", (e) => {
    painting = true;
    lastX = e.clientX - canvas.offsetLeft;
    lastY = e.clientY - canvas.offsetTop;
});

canvas.addEventListener("mouseup", () => painting = false);
canvas.addEventListener("mousemove", draw);

// Clear canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Change brush color based on color picker input
function changeColor(color) {
    brushColor = color; // Update brush color when the user selects a new color
}

// Change brush size based on the range input
function changeBrushSize(size) {
    brushSize = size;
}

function draw(e) {
    if (!painting) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Set the stroke properties based on the selected color and size
    ctx.fillStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw the line from the last position to the current position
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Update the last position for the next segment
    lastX = x;
    lastY = y;
}
