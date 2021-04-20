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

	const grid = document.querySelector.('.grid')

	function createBoard() {
		for (let i = 0; i < cardArray.length; i++) {
			var card = document.createElement('img')
			card.setAttribute('src', 'images/blank.png')
			card.setAttribute('data-id', i)
			//card.addEventListener('click', flipcard)
			grid.appendChild(card)
		}
	}

	createBoard()
