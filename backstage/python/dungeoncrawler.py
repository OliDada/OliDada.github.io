from os import system
import random

class Character:
    def __init__(self, name, health, attack_power):
        self.name = name
        self.health = health
        self.attack_power = attack_power

    def is_alive(self):
        return self.health > 0
    
    def take_damage(self, damage):
        self.health -= damage
        if self.health < 0:
            self.health = 0

    def heal(self, amount):
        self.health += amount
    
    def attack(self, other):
        damage = random.randint(0, self.attack_power)
        other.take_damage(damage)
        return damage

def combat(player, enemy, inventory):
    if enemy.name == "Goblin":
        print("              ,      ,")
        print("             /(.-""-.)\ ")
        print("         |\  \/      \/  /|")
        print("         | \ / =.  .= \ / |")
        print("          \( \   o\/o   / )/")
        print("           \_, '-/  \-' ,_/")
        print("             /   \__/   \ ")
        print("             \ \__/\__/ /")
        print("           ___\ \|--|/ /___")
        print("         /`    \      /    `\ ")
        print("        /       '----'       \ ")
    elif enemy.name == "Wolf":
        print("                             _")
        print("                  / \      _-'")
        print("                _/|  \-''- _ /")
        print("            __-' { |          \ ")
        print("                /             \ ")
        print("               /       o.  |o | ")
        print("               |            \ ;")
        print("                            ',")
        print("                \_         __\ ")
        print("                   ''-_    \.//")
        print("                    / '-____'")
        print("                   /")
        print("                  _'")
        print("                _-'")
    print(f"\nA wild {enemy.name} appears!\n")

    while player.is_alive() and enemy.is_alive():
        

        print(f"{player.name}'s HP: {player.health} | {enemy.name}'s HP: {enemy.health}")

        print("What will you do?")
        print("1. Attack")
        print("2. Use healing potion")
        print("3. Flee")

        choice = input(": ")

        if choice == "1":
            damage = player.attack(enemy)
            print(f"You attack {enemy.name} for {damage} damage!")

        elif choice == "2":
            if "healing potion" in inventory:
                inventory.remove("healing potion")
                player.heal(10)
                print("You use a healing potion and restore 10 HP")
            else:
                print("You are out of healing potions!")

        elif choice == "3":
            escape = random.randint(0, 10)
            if escape >= 5:
                print("You flee from the battle")
                break
            else:
                print("You fail to flee from the battle")
        else:
            continue
        
        if enemy.is_alive():
            damage = enemy.attack(player)
            print(f"\n{enemy.name} attacks you for {damage} damage!")
            input("Press Enter to continue...")
        
        if not player.is_alive():
            print(f"You were brutally murdered by {enemy.name}... The End")
        
        if not enemy.is_alive():
            system("clear||cls")
            print(f"You killed the {enemy.name}!")
            inventory.append("healing potion")
            break
        system("clear||cls")

N = "(N)orth"
S = "(S)outh"
E = "(E)ast"
W = "(W)est"

def display_grid(grid, location):
   
    max_width = max(len(cell) for cell in grid) + 2

    for i in range(3):

        row = [
            f" o " if cell == location else "   "
            for cell in grid[i * 3:(i + 1) * 3]
        ]

        row = [cell.center(max_width) for cell in row]
        if i == 0:
            print("   ".join(row))
        elif i == 1:
            print(" | ".join(row))
        else:
            print(f"{row[0]}   {row[1]} | {row[2]}")
        if i == 0:
            print("--  --+--   --+--  --")
        if i == 1:
            print("--  --+-------+--  --")

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

def tile_description(location):
    descriptions = {
        "1,1": "You are standing in a dimly lit entryway. The smell of moss fills the air.",
        "2,1": "The floor is cold here, and you see signs of old footprints headingeast",
        "3,1": "You are in an old, abandoned dining hall. Cobwebs hang from the chandaliers.",
        "1,2": "A small crack in the wall lets some light in, revealing old drawings of creatures from the past.",
        "2,2": "You stand in the middle of the dungeon. The echoes of distant noises give you an uneasy feeling.",
        "3,2": "A small stream of water runs through this area, the ground slippery and wet.",
        "1,3": "The air feels heavy here, and you notice strange carvings on the walls.",
        "2,3": "A large chest is locked in the corner of the room, and you can hear faint noises from inside.",
        "3,3": "This room is empty except for an old throne in the center. It feels strangely ominous."
    }
    return descriptions.get(location, "You don't know where you are.")

def encounter(location, inventory):
    # Random encounter generator
    encounters = {
        "1,1": "You see a rat scurrying in the corner. It seems harmless.",
        "3,2": "A goblin jumps out from the shadows and challenges you to a fight!",
        "3,1": "You find a healing potion lying in the corner. It's untouched.\n Item added to inventory",
        "1,2": "You hear the sound of footsteps approaching. Someone is nearby.",
        "2,2": "A trap is triggered, and arrows shoot from the walls! You narrowly dodge them.",
        "2,3": "A wild wolf appears, growling and ready to attack!",
        "1,3": "You find an old note on the floor, it seems to hint at the location of hidden treasure.",
        "2,3": "A ghostly figure appears and offers to help you, but at a price.",
        "3,3": "You are surrounded by an eerie silence. Suddenly, the throne creaks as if someone just sat in it."
    }

    items_found = {
        "3,1": ["healing potion"],
    }

    combat_encounters = {
        "3,2": "goblin",
        "2,3": "wolf",
    }

    for location_key, item_list in items_found.items():
        if location == location_key:
            for item in item_list:
                inventory.append(item)
    
    for location_key, enemy_name in combat_encounters.items():
        if location == location_key:
            if enemy_name == "goblin":
                enemy = Character("Goblin", 30, 5)
            elif enemy_name == "wolf":
                enemy = Character("Wolf", 25, 6)

            combat(player, enemy, inventory)

    return encounters.get(location, "Nothing happens here.")

#def pull_lever(coins):

    print("You see a lever.")
    lever_pulled = input("Pull the lever? y/n: ").lower()
    if lever_pulled == "y":
        print("You found a coin!")
        coins += 1
    return coins

def display_inventory(inventory):
    if not inventory:
        print("You're inventory is empty")
    else:
        print("Your items:")
        for item in inventory:
            print(f"- {item}")

def play(grid):
    
    coins = 0
    inventory = []
    location = "1,1"
    global player   
    player_name = f"{user_name} the {user_class}"
    player = Character(player_name, 100, 10)
    

    while True:
        system("clear||cls")

        print("\nYou enter the dungeon. As soon as you enter, the entrance collapses behind you. Leaving you trapped in the dungeon.\n")
        display_grid(grid, location)
        #print(f"\nYou are at {location}")
        #print(f"You have {coins} coins")
        
        print(encounter(location, inventory))
        print("What do you want to do?")
        print("1. Examine your surroundings")
        print("2. Open your inventory")
        print("3. Move to a different room")
        print("4. Take your own life (quit the game)")

        choice = input(": ")

        if choice == "4":
            play_again()
        if choice not in ["1","2","3","4"]:
            continue
        if choice == "1":
            print(tile_description(location))
            input("Press Enter to continue...")
        elif choice == "2":
            display_inventory(inventory)
            input("Press Enter to continue...")
        elif choice == "3":

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

        #if location in ["1,3", "3,1", "3,3"]:
        #    coins = pull_lever(coins)
        
        if coins == 3:
            print("You found all the coins! You Win!")
            break


def play_again():
    print("Do you want to play again?")
    print("Y or N")
    while True:
        answer = input(": ").lower()
        try:
            if "y" in answer:
                main()
            elif "n" in answer:
                break
            else:
                raise ValueError
        except ValueError:
            print("Type Y or N")
            continue

def main():
    system("clear||cls")
    print("▗▄▄▄▖▗▖ ▗▖▗▄▄▄▖    ▗▄▄▄ ▗▖ ▗▖▗▖  ▗▖ ▗▄▄▖▗▄▄▄▖ ▗▄▖ ▗▖  ▗▖")
    print("  █  ▐▌ ▐▌▐▌       ▐▌  █▐▌ ▐▌▐▛▚▖▐▌▐▌   ▐▌   ▐▌ ▐▌▐▛▚▖▐▌")
    print("  █  ▐▛▀▜▌▐▛▀▀▘    ▐▌  █▐▌ ▐▌▐▌ ▝▜▌▐▌▝▜▌▐▛▀▀▘▐▌ ▐▌▐▌ ▝▜▌")
    print("  █  ▐▌ ▐▌▐▙▄▄▖    ▐▙▄▄▀▝▚▄▞▘▐▌  ▐▌▝▚▄▞▘▐▙▄▄▖▝▚▄▞▘▐▌  ▐▌\n")

    global user_class
    global user_name
    user_name = input("What is your name?: ")
    while True:
        user_class = input("Are you an elf (1), a dwarf (2) or a wizard (3)?: ")
        try:
            if user_class not in ["1", "2", "3"]:
                raise ValueError("Choose 1, 2, or 3.")
            
            if user_class == "1":
                user_class = "elf"
                break
            elif user_class == "2":
                user_class = "dwarf"
                break
            elif user_class == "3":
                user_class = "wizard"
                break

        except ValueError as e:
            print(e)

    print("{} the {}, do you want to travel into the dungeon?".format(user_name, user_class))
    print("(Y or N):")
    
    
    while True:
        answer = input(": ").lower()
        try:
            if "y" in answer:
                grid = [f"{x},{y}" for y in range(1,4) for x in range(1,4)]
                play(grid)
            elif "n" in answer:
                print("You go home like a coward... The End")
                play_again()
                break
            else:
                raise ValueError
        except ValueError:
            print("Type Y or N")
            continue
            

        

if __name__ == "__main__":
    main()
