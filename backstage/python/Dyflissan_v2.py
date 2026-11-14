
nafn = input("Hvað heitir þú?: ")
type = int(input("Ert þú álfur (1), dvergur (2) eða galdramaður (3): "))
    

def intro():    
    print("Þú labbar inn í dýflissuna. Það eru þrjár hurðir. Ein úr viði, önnur úr gulli og þriðja úr stáli.")
    print("1. Viðar hurð")
    print("2. Gull hurð")
    print("3. Stál hurð")
    print("4. Þú ferð að heim að horfa á bíómynd")

    hurd = int(input("Hvaða hurð velur þú?: "))
    
    if hurd == 1:
        vidar_hurd()
    elif hurd == 2:
        gull_hurd()
    elif hurd == 3:
        stal_hurd()
    elif hurd == 4:
        print("Þú ferð heim. Hvað ertu að pæla?")
        print("Endir!")

def opna_kistur():
    print("Þú kemst að kistunum.")
    print("Viltu:")
    print("1. Opna bláu kistuna.")
    print("2. Opna grænu kistuna.")
    print("3. Fara til baka.")
    
    val = int(input(""))
    
    if val == 1:
        print("Þú opnar bláu kistuna. En hún springur og þú deyrð!")
        print("Endir!")
    elif val == 2:
        print("Þú opnar grænu kistuna. Þú sérð 500 billjón krónur!!!")
        print("Þú vannst! Til hamingju!")
        print("Endir!")
    elif val == 3:
        intro()

def kistur(veikur, skrimsli):
    print("Þú sérð ekki neitt nema eina græna kistu og eina bláa kistu í endanum á herberginu")
    print("Viltu:")
    print("1. Skoða þig um.")
    print("2. Labba að kistunum.")
    print("3. Fara til baka.")
    
    val = int(input(""))
    
    if val == 1:
        print("Þú sérð tvö fótspor á jörðinni. Það er ósýnilegur maður í herberginu.")
        print("Viltu:")
        print("1. Ráðast á hann.")
        print("2. Láta eins og þú sjáir hann ekki.")
        print("3. Fara aftur til baka.")
        
        valid = int(input(""))
        
        if valid == 1:
            if veikur == "nei":
                print("Þú ræðst á ósýnilega manninn. Ósýnilegi maðurinn tekur ekki eftir þér og þú drepur hann!")
                opna_kistur()
            elif veikur == "já":
                print("Þú reynir að ráðast á ósýnilega manninn. En þú ert of veik/ur út af vatninu sem þú syntir í. Það voru svo mikið af bakteríum í því. Ósynliegi maðurinn tekur upp sverð og stingur þig. Þú deyrð!")
                print("Endir!")
        elif valid == 2:
            if skrimsli == "já":
                print("Þú lætur eins og þú sjáir hann ekki og labbar að kistunum en ósýnilegi maðurinn ræðst á þig. En þríhöfða skrímslið kemur og bjargar þér. Það drepur ósýnilega manninn.")
                opna_kistur()
            else:
                print("Þú lætur eins og þú sjáir hann ekki og labbar að kistunum en ósýnilegi maðurinn ræðst á þig og drepur þig!")
                print("Endir!")
        elif valid == 3:
            intro()
        
    elif val == 2:
        if skrimsli == "já":
            print("Þú labbar að kistunum en það ræðst ósýnilegur maður á þig. En þríhöfða skrímslið kemur og bjargar þér. Það drepur ósýnilega manninn.")
            opna_kistur()
        else:
            print("Þú labbar að kistunum en það ræðst ósýnilegur maður á þig og drepur þig!")
            print("Endir!")
    elif val == 3:
        intro()
    
    

def hola():
    print("Þú hoppar ofan í holuna. Þú sérð risa stóran klett!")
    if type == 1:
        print("Þú reynir að grafa holu. Þú verður svo þreytt/ur að það líður yfir þig.")
        intro()
    elif type == 2:
        print("Þú notar dverga öxina þína til að höggva þér leið í gegnum klettinn.")
        kistur("nei", "nei")
    elif type == 3:
        print("Þú teleportar þig hinum megin við klettinn.")
        kistur("nei", "nei")
    
    
    
        

def vidar_hurd():
    print("Þú labbar inn um viðar hurðina og sérð holu")
    print("Hvað vilt þú gera?")
    print("1. Hoppa ofan í holuna.")
    print("2. Skoða þig um.")
    print("3. Fara til baka.")
    
    val = int(input(""))
    
    if val == 1:
        hola()
    elif val == 2:
        print("Þú sérð hurð. Viltu Fara í gegnum hana?")
        print("1. Nei")
        print("2. Já")
        val = int(input())
        
        if val == 1:
            vidar_hurd()
        if val == 2:
            intro()
            
    elif val == 3:
        intro()
    
def stigi():
    print("Þú sérð tvær sundlaugar. Ein er með saltvatni og hin er með venjulegu vatni. Hinum megin við sundlaugarnar er hurð.")
    print("Viltu:")
    print("1. Synda í gegnum saltvatnið.")
    print("2. Synda í gegnum venjulega vatnið.")
    print("3. Fara til baka")
    
    val = int(input())
    
    if val == 1:
        print("Þú syndir í gegnum saltvatnið og þú labbar í gegnum hurðina.")
        kistur("nei", "nei")
    elif val == 2:
        print("Þú syndir í gegnum venjulega vatnið og þú labbar í gegnum hurðina. En þér líður smá skríngilega.")
        kistur("já", "nei")
    elif val == 3:
        intro()
    
def gull_hurd():
    print("Þú labbar inn um gull hurðina og sérð dreka! Hann sér þig ekki ennþá. Bakvið drekann sérð þú stiga sem leiðir niður í kjallara.")
    print("Hvað vilt þú gera?")
    print("1. Laumast fram hjá drekanum.")
    print("2. Ráðast á hann.")
    print("3. Fara til baka.")
    
    val = int(input(""))
    
    if val == 1:
        print("Þú laumast fram hjá drekanum og ferð niður stigann")
        stigi()
    elif val == 2:
        print("Þú ræðst á drekann.")
        if type == 1:
            print("Þú notar álfa galdrana þína til þess að svæfa drekann! Þú ferð niður stigann.")
            stigi()
        elif type == 2:
            print("Þú reynir að lemja drekann með dverga exinni þinni. En þú ert of hægur. Drekinn tortímir þær!")
            print("Endir!")
        elif type == 3:
            print("Þú notar galdrastafinn þinn og frystir drekann! Þú ferð niður stigann.")
            stigi()
    elif val == 3:
        intro()
        
        
def troll(tamid):
    print("Þú sérð risa stórt tröll með kylfu! Það er sofandi. Fyrir aftan tröllið er hurð.")
    print("Viltu:")
    print("1. Læðast fram hjá því.")
    print("2. Ráðast á það á meðan það er sofandi.")
    print("3. Fara til baka.")
    
    val = int(input(""))
    
    if val == 1:
        print("Þú reynir að læðast en skrímslið vaknar og lemur þig með kylfunni. Þú deyrð!")
        print("Endir!")
    elif val == 2:
        print("Þú drepur tröllið og ferð í gegnum hurðina")
        kistur("nei", tamid)
    elif val == 3:
        intro()

def stal_hurd():
    print("Þú labbar inn um stál hurðina og sérð þríhöfða skrímsli! En fyrir aftan skrímslið sérðu hurð.")
    print("Hvað vilt þú gera?")
    print("1. Reyna að skera hausana af því.")
    print("2. Hoppa á það og temja það.")
    print("3. Flýja")
    
    val = int(input(""))
    
    if val == 1:
        print("Þú skerð alla hausana af skrímslinu og það verður blint. Þú ferð í gegnum hurðina.")
        troll()
    elif val == 2:
        if type == 1 or type == 2:
            print("Þú nærð að temja skrímslið. Þú klappar því á hausana og labbar í gegnum hurðina.")
            troll("já")
        elif type == 3:
            print("Þú reynir að temja skrímslið. En það brýtur galdrastafinn þinn. Þú verður svo miður þínn að þú gefst upp og ferð heim.")
            print("Endir!")
        
    elif val == 3:
        intro()
    
    
    


    

def main():
    
    if type == 1:
        print("Velkominn", nafn, "álfur")
    elif type == 2:
        print("Velkominn", nafn, "dvergur")
    elif type == 3:
        print("Velkominn", nafn, "galdramaður")
        
    intro()
    
main()




    
