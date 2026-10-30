N = "(N)orth"
S = "(S)outh"
E = "(E)ast"
W = "(W)est"

def display_grid(grid, location):
   
    max_width = max(len(cell) for cell in grid) + 2

    for i in range(3):

        row = [
            f"[{cell}]" if cell == location else cell
            for cell in grid[i * 3:(i + 1) * 3]
        ]

        row = [cell.center(max_width) for cell in row]

        if i == 0:
            print("   ".join(row))
        elif i == 1:
            print(" | ".join(row))
        else:
            print(f"{row[0]}   {row[1]} | {row[2]}")
        if i < 2:
            print("--  --+--   --+--  --")

def get_available_moves(location):

    moves = {
        "1,1": [E, S],
        "2,1": [E, S, W],
        "3,1": [S, W],
        "1,2": [N, S],
        "2,2": [N, S],
        "3,2": [N, S],
        "1,3": [N, E],
        "2,3": [N, W],
        "3,3": [N]
    }
    return moves.get(location, [])

def pull_lever(coins):

    print("You see a lever.")
    lever_pulled = input("Pull the lever? y/n: ").lower()
    if lever_pulled == "y":
        print("You found a coin!")
        coins += 1
    return coins

def play(grid):
    
    coins = 0
    location = "1,1"

    while True:
        display_grid(grid, location)
        print(f"\nYou are at {location}")
        print(f"You have {coins} coins")
        print("Available moves:", ", ".join(get_available_moves(location)))

        move = input("Enter your move: ").strip().upper()
        valid_moves = {
            "(N)orth": (0, -1),
            "(S)outh": (0, 1),
            "(E)ast": (-1, 0),
            "(W)est": (1, 0),
        }

        move_found = None
        for direction, (dx, dy) in valid_moves.items():
            if move in direction:
                move_found = direction
                break

        if move_found not in get_available_moves(location):
            print("Invalid move! Try again.")
            continue
            
        x, y = map(int, location.split(","))
        if "N" in move_found:
            y -= 1
        elif "S" in move_found:
            y += 1
        elif "E" in move_found:
            x += 1
        elif "W" in move_found:
            x -= 1
        location = f"{x},{y}"

        if location in ["1,3", "3,1", "3,3"]:
            coins = pull_lever(coins)
        
        if coins == 3:
            print("You found all the coins! You Win!")
            break

def main():

    grid = [f"{x},{y}" for y in range(1,4) for x in range(1,4)]
    play(grid)

if __name__ == "__main__":
    main()
