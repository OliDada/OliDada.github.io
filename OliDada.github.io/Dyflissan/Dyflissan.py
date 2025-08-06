def start():
    global userClass
    userName = input("Hvað heitir þú?: ")
    userClass = input("Ertu álfur(1), dvergur(2) eða galdramaður(3)?: ")
    if userClass == "1": userClass = ("álfur")
    elif userClass == "2": userClass = ("dvergur")
    elif userClass == "3": userClass = ("galdramaður")
    print("{} {}, vilt þú fara inn í Dýflissuna og leita að gullinu".format(userName, userClass))
    print("(J eða N):")

    answer = input("> ").lower()

    if "j" in answer:
        dyflissa()
    elif "n" in answer:
        print("Þú ferð heima að sofa... Endir")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")

def dyflissa():
    print("Þú ert kominn inn í Dýflissuna.")
    print("Á móti þér er græn hurð og við hliðina á þér gul hurð.")
    print("Viltu fara inn um grænu hurðina (1),")
    print("opna gulu hurðina (2) eða flýja (3)")

    answer = input("> ")

    if answer == "1":
        greenDoor()
    elif answer == "2":
        yellowDoor()
    elif answer == "3":
        print("Þú flýrð heim eins og aumingji... Endir")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")


def greenDoor():
    print("Þú ferð inn um hurðina.")
    print("Þú sérð sofandi mann með sverð og fyrir aftan hann er kista.")
    print("Viltu læðast framhjá manninum (1) eða ráðast á hann (2)?")

    answer = input("> ")

    if answer == "1":
        chest()
    elif answer == "2":
        attack1()
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")


def chest():
    print("Þú kemst að kistunni án þess að vekja manninn. viltu opna kistuna?(J eða N)")

    answer = input(">")

    if "j" in answer:
        openChest()
    elif "n" in answer:
        print("Þú ferð heima að sofa... Endir")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")

def openChest():
    print("Þú opnar kistuna og sérð poka af gulli.")
    print("Þú tekur pokann, en um leið vaknar maðurinn og ræðst á þig.")
    print("Viltu berjast (1), bjóða honum gullpening (2)")
    print("eða sættast við örlögin þín (3)?")

    answer = input("> ")

    if answer == "1":
        attack2()
    elif answer == "2":
        offer()
    elif answer == "3":
        print("Þú lokar augunum. Maðurinn stingur þig í magann og þér blæðir út. Hvað vartsu að pæla?")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")


def attack1():
    global userClass
    if userClass == "álfur": userClass = ("álfa hnífnum þínum")
    elif userClass == "dvergur": userClass = ("dverga öxinni þinni")
    elif userClass == "galdramaður": userClass = ("galdrastafnum þínum")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")


    print("Þú ræðst á manninn með {}.".format(userClass))
    print("Hann öskrar úr hræðslu og spyr 'afhverju?...' áður enn hann deyr.")
    print("Þú opnar kistuna skömmustulega. Í henni sérðu poka fullan af gulli.")
    print("Viltu taka gullið?(J eða N):")

    answer = input("> ")

    if "j" in answer:
        print("Þú tekur pokann og ferð heim með tárin í augunum. Endir")
    elif "n" in answer:
        print("Þú tekur ekki gullið og ferð heim með tárin í augunum. Hvað ertu að pæla? Endir ")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")


def attack2():

    global userClass
    if userClass == "álfur": userClass = ("álfa hnífnum þínum")
    elif userClass == "dvergur": userClass = ("dverga öxinni þinni")
    elif userClass == "galdramaður": userClass = ("galdrastafnum þínum")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")

    if userClass == "galdramaður":
        print("Þú skýtur manninn með eldbolta úr {}.".format(userClass))
        print("Hann öskrar úr hræðslu og spyr 'afhverju?...' áður enn hann brennur til dauða.")
        print("Þú ferð heim með gullið. Endir")

    if userClass == "dvergur":
        print("Þú ræðst á manninn með {}.".format(userClass))
        print("Hann öskrar úr hræðslu og spyr 'afhverju?...' áður enn hann deyr.")
        print("Þú ferð heim með gullið. Endir")
    
    else:
        print("Þú reynir að stinga manninn með {} en hann sker af þér hausinn áður en þú nærð því. Endir.".format(userClass))
        

def offer():
    print("Þú bíður manninum gull pening.")
    print("Hann þakkar þér fyrir og fer aftur að sofa.")
    print("Þú ferð heim með gullið og bros á vör. Vel gert! Endir")

def yellowDoor():
    print("Þú ferð inn um hurðina.")
    print("Fyrir framan þig stendur tröll með kylfu.")
    print("Fyrri aftan tröllið er hurð")
    print("Tröllið sér þig og gerir sig tilbúið til þess að lemja þig með kylfunni sinni")
    print("Viltu berjast (1), Hlaupa að hurðinni (2) eða flýja (3)")

    answer = input(">")

    if answer == "1":
        attack3()
    elif answer == "2":
        print("Þú kemst að hurðinni rétt áður en tröllið nær að kremja þig")
        greenDoor()
    elif answer == "3":
        print("Þú grætur eins og smábarn og hleypur heim með kúkinn í brókunum")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")


def attack3():
    global userClass
    if userClass == "álfur":
        print("Þú stingur tröllið með álfa hnífnum þínum. Það gerir ekkert og tröllið drepur þig. Endir")
    elif userClass == "dvergur":
        print("Þú skerð vinstri fót tröllsins af með dverga öxinni þinni. Það gerir tröllið einungis reiðara og það drepur þig. Endir")
    elif userClass == "galdramaður":
        print("Þú býrð til eldbolta með galdrastafnum þínum og brennir tröllið upp til agna.")
        trollDeath()


def trollDeath():
    print("Viltu fara í gegnum hurðina? (J eða N)")

    answer = input(">")

    if "j" in answer:
        greenDoor()
    elif "n" in answer:
        print("Þú hefur fengið nóg og ferð heim. Endir")
    else:
        gameOver("Kannt þú ekki að fylgja leiðbeiningum?")

def gameOver(reason):
    print("\n" + reason)
    print("Endir")

print("""
██████╗ ██╗   ██╗███████╗██╗     ██╗███████╗███████╗ █████╗ ███╗   ██╗
██╔══██╗╚██╗ ██╔╝██╔════╝██║     ██║██╔════╝██╔════╝██╔══██╗████╗  ██║
██║  ██║ ╚████╔╝ █████╗  ██║     ██║███████╗███████╗███████║██╔██╗ ██║
██║  ██║  ╚██╔╝  ██╔══╝  ██║     ██║╚════██║╚════██║██╔══██║██║╚██╗██║
██████╔╝   ██║   ██║     ███████╗██║███████║███████║██║  ██║██║ ╚████║
╚═════╝    ╚═╝   ╚═╝     ╚══════╝╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝
                                                                      """)

start()
