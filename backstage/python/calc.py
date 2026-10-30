
def add(num1, num2):
    return num1 + num2

def sub(num1, num2):
    return num1 - num2

def mult(num1, num2):
    return num1 * num2

def div(num1, num2):
    try:
        return num1 / num2
    except ZeroDivisionError:
        print("Error: Cannot divide by zero")
        return None

def calculate():
    try:
        num = float(input("Enter the first number: "))
    except ValueError:
        print("Invalid input!")
        return
    while True:
        try:
            print("What do you want to calculate?")
            print("1. Add")
            print("2. Subtract")
            print("3. Multiply")
            print("4. Divide")
            print("5. Quit")
            choice = int((input(": ")))
            if choice not in [1,2,3,4,5]:
                raise ValueError
            if choice == 5:
                break
        except ValueError:
            print("Pick a number between 1-5")
        try:
            next_num = float(input("Enter the next number: "))
        except ValueError:
            print("Invalid input!")
            continue
        
        if choice == 1:
            num = add(num, next_num)
        elif choice == 2:
            num = sub(num, next_num)
        elif choice == 3:
            num = mult(num, next_num)
        elif choice == 4:
            result = div(num, next_num)
            if result is not None:
                num = result
        print(f"Current result: {num}")
    
    print(f"Final result: {num}")


def main():
    print("Welcome to the calculator!")
    while True:
        print("\nChoose an option:")
        print("1. Calculate")
        print("2. Quit")
        try:
            choice = int(input(": "))
            if choice == 1:
                calculate()
            elif choice == 2:
                print("Goodbye!")
                break    
            else:
                print("Please choose 1 or 2")
        except ValueError:
            print("Please enter a number")

if __name__ == "__main__":
    main()