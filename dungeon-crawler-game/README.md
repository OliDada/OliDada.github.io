# Dungeon Crawler Game

## Overview
Dungeon Crawler is an exciting adventure game where players navigate through a mysterious dungeon, battling enemies, collecting items, and exploring various maps. This project is built using HTML, CSS, and JavaScript, leveraging the p5.js library for rendering and game mechanics.

## Project Structure
```
dungeon-crawler-game
├── src
│   ├── index.html        # Main HTML document for the game
│   ├── style.css        # Styles for the game interface
│   ├── sketch.js        # Main game loop and rendering logic
│   ├── game
│   │   ├── map.js       # Manages the game map
│   │   ├── player.js    # Represents the player character
│   │   ├── enemy.js     # Represents enemies in the game
│   │   └── items.js     # Represents collectible items
│   └── utils
│       └── helpers.js   # Utility functions for the game
├── package.json          # npm configuration file
└── README.md             # Project documentation
```

## Getting Started

### Prerequisites
- Ensure you have Node.js installed on your machine.

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd dungeon-crawler-game
   ```
3. Install the dependencies:
   ```
   npm install
   ```

### Running the Game
To start the game, open `src/index.html` in your web browser. You can also run a local server for better performance using:
```
npx http-server src
```

### Controls
- Click the "Start Game" button to begin your adventure.
- Use the controls provided to navigate and interact with the game.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License. See the LICENSE file for details.