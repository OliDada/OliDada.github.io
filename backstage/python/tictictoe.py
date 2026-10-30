winning_combos = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6)
)
 
 
def play(player):
    """Player selects cell.  Return winning combo if player won."""
    print("\n", " | ".join(grid[:3]))
    print("---+---+---")
    print("", " | ".join(grid[3:6]))
    print("---+---+---")
    print("", " | ".join(grid[6:]))
 
    while True:
        try:
            cell = int(input(f"Enter cell for {player}: "))
            if str(cell) not in grid:
                raise ValueError
            grid[cell-1] = player
            break
        except ValueError:
            print("Enter number of open cell.")
 
    for combo in winning_combos:
        if all(grid[cell] == player for cell in combo):
            return combo
    return None
 
 
player1 = "X"
player2 = "O"
player = player1
grid = list("123456789")
 
for i in range(9):
    won = play(player)
    if won:
        print(f"Player {player} won!")
        break
    player = player1 if player == player2 else player2
else:
    print("Game ends in a draw.")