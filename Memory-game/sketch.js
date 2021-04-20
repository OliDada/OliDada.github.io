// Hér kemur kóðinn þinn:

document.addEventListener('DOMContentLoaded', () => {

	const cardArray = [
		{
			name: 'demantur'
			img: 'images/demantur.png'
		},
		{
			name: 'demantur'
			img: 'images/demantur.png'
		},
		{
			name: 'ferningur'
			img: 'images/demantur.png'
		},
		{
			name: 'ferningur'
			img: 'images/demantur.png'
		},
		{
			name: 'hjarta'
			img: 'images/demantur.png'
		},
		{
			name: 'hjarta'
			img: 'images/demantur.png'
		},
		{
			name: 'hringur'
			img: 'images/demantur.png'
		},
		{
			name: 'hringur'
			img: 'images/demantur.png'
		},
		{
			name: 'sexhyrningur'
			img: 'images/demantur.png'
		},
		{
			name: 'sexhyrningur'
			img: 'images/demantur.png'
		},
		{
			name: 'stjarna'
			img: 'images/demantur.png'
		},
		{
			name: 'stjarna'
			img: 'images/demantur.png'
		},
		{
			name: 'þríhyrningur'
			img: 'images/demantur.png'
		},
		{
			name: 'þríhyrningur'
			img: 'images/demantur.png'
		},
		{
			name: 'blank'
			img: 'images/demantur.png'
		},
		{
			name: 'blank'
			img: 'images/demantur.png'
		},
		{
			name: 'white'
			img: 'images/demantur.png'
		},
		{
			name: 'white'
			img: 'images/demantur.png'
		}
	]

	cardArray.sort(() => 0.5 - Math.random())


	const grid = document.querySelector.('.grid')
	const resultDisplay = document.querySelector('#result')
	var cardsChosen = []
	var cardsChosenId = []
	var cardsWon = []

	function createBoard() {
		for (let i = 0; i < cardArray.length; i++) {
			var card = document.createElement('img')
			card.setAttribute('src', 'images/blank.png')
			card.setAttribute('data-id', i)
			card.addEventListener('click', flipCard)
			grid.appendChild(card)
		}
	}

	function checkForMatch() {
		var cards = document.querySelectorAll('img')
		const optionOneId = cardsChosenId(0)
		const optionTwoId = cardsChosenId(1)
		if (cardsChosen[0] === cardsChosen[1]) {
			alert('Samstæða!')
			cards[optionOneId].setAttribute('src', 'imgages/white.png')
			cards[optionTwoId].setAttribute('src', 'imgages/white.png')
			cardsWon.push(cardsChosen)
		} else  {
			cards[optionOneId].setAttribute('src', 'images/blank.png')
		  cards[optionTwoId].setAttribute('src', 'images/blank.png')
			alert('Reyndu aftur')
		}
		cardsChosen = []
		cardsChosenId = []
		resultDisplay.textContent = cardsWon.length
		if (cardsWon.length === cardArray.length/2) {
			resultDisplay.textContent = 'Þú vannst!'
	}



	function flipCard() {
		var cardId = this.getAttribute('data-id')
		cardsChosen.push(cardArray[cardId].name)
		cardsChosenId.push(cardId)
		this.setAttribute('src', cardArray[cardId].img)
		if (cardsChosen.length === 2) {
			setTimeout(checkForMatch, 500)
	}


	createBoard()
