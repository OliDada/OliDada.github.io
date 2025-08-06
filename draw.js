// Check if canvas exists before initializing
if (document.getElementById("drawingCanvas")) {
// Global variables
let painting = false; // Tracks if the mouse is pressed
let lastX = 0; // Last x-coordinate
let lastY = 0; // Last y-coordinate
let brushColor = "#000000"; // Default brush color
let brushSize = 5; // Default brush size

// Get the canvas and context
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

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
    ctx.strokeStyle = brushColor; // Use strokeStyle for drawing lines
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
}
