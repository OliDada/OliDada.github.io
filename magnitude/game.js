// Magnitude — one surprising estimate every day, with 50 authored days.
(() => {
  const $ = id => document.getElementById(id);
  const LAUNCH = [2026, 10, 12];
  const DAILY_COUNT = 5;
  const questions = [
    ['How many times does a person blink in a day?', 'Count every ordinary blink, not just the dramatic ones.', 18000, 100, 100000, 'At roughly 15–20 blinks per minute, a waking day adds up quickly.'],
    ['How many litres of water are in a small cumulus cloud?', 'Think fluffy, harmless, and secretly much heavier than it looks.', 500000, 10000, 10000000, 'A cloud is made of tiny droplets spread across a huge volume.'],
    ['How many kilometres of roads are there in Iceland?', 'Include the whole country, not just Reykjavík.', 13000, 1000, 100000, 'Iceland has an extensive road network for its small population.'],
    ['How many Lego bricks would fill a standard bathtub?', 'Imagine the tub completely full, with no water between the bricks.', 9000, 100, 100000, 'The air gaps between bricks matter almost as much as the bricks themselves.'],
    ['How many seconds are in one week?', 'You probably know the number. Trust your first instinct.', 604800, 10000, 10000000, 'Seven days × 24 hours × 60 minutes × 60 seconds.'],
    ['How many heartbeats does a hummingbird make in one minute?', 'This tiny bird has a surprisingly frantic engine.', 1200, 100, 10000, 'A hummingbird can beat its wings and its heart at astonishing speeds.'],
    ['How many litres of air does a person breathe in a day?', 'Include every quiet breath, not just deep breaths.', 11000, 1000, 100000, 'A resting adult breathes roughly 11,000 litres of air each day.'],
    ['How many grains of sand are in a teaspoon?', 'Picture dry beach sand, not a perfect laboratory sample.', 50000, 1000, 1000000, 'Tiny grains pack together more densely than intuition suggests.'],
    ['How many kilometres does Earth travel around the Sun in one day?', 'The ground feels still, but we are moving very fast.', 2560000, 100000, 10000000, 'Earth travels around 2.56 million kilometres along its orbit each day.'],
    ['How many words are in a typical novel?', 'Think a readable paperback, not an epic fantasy brick.', 80000, 10000, 1000000, 'Many novels land somewhere between 50,000 and 100,000 words.'],
    ['How many hairs are on an average human head?', 'Blond, brown, black, and red hair all count.', 100000, 10000, 1000000, 'Hair density varies, but 100,000 is a useful average.'],
    ['How many litres of blood does an adult human have?', 'Estimate the whole supply inside one person.', 5, 1, 20, 'An average adult carries roughly five litres of blood.'],
    ['How many keys are on a standard piano?', 'Include the black keys too.', 88, 20, 200, 'A modern standard piano has 52 white keys and 36 black keys.'],
    ['How many bones are in an adult human body?', 'Babies have more, but this is the grown-up number.', 206, 50, 1000, 'Some small bones fuse as we grow, leaving 206 in most adults.'],
    ['How many kilometres is the Moon from Earth?', 'Use the average distance, not the closest possible pass.', 384400, 10000, 1000000, 'The Moon is about 384,400 kilometres away on average.'],
    ['How many moons could fit across the width of Earth?', 'Compare diameters, not surface area.', 4, 1, 20, 'Earth is about four times wider than the Moon.'],
    ['How many minutes are in a year?', 'A year is longer than 500,000 minutes, but by how much?', 525600, 100000, 1000000, 'That is 365 days of 24 hours and 60 minutes.'],
    ['How many Lego bricks are made every year?', 'Imagine the entire world making tiny plastic bricks.', 5_000_000_000, 100_000_000, 100_000_000_000, 'Lego production is measured in billions of pieces each year.'],
    ['How many people can fit inside a blue whale’s mouth?', 'Not that you should try. This is a scale question.', 50, 5, 500, 'A blue whale mouth is enormous, though its throat is much narrower.'],
    ['How many litres of water are in an Olympic swimming pool?', 'Picture the whole pool, not just the deep end.', 2500000, 100000, 10000000, 'A standard Olympic pool holds about 2.5 million litres.'],
    ['How many pixels are in a 4K television image?', 'Count width multiplied by height.', 8294400, 1000000, 100000000, '4K UHD is 3,840 by 2,160 pixels.'],
    ['How many times does lightning strike Earth each second?', 'Storms are happening somewhere all the time.', 44, 1, 200, 'Earth gets roughly 40–50 lightning flashes every second.'],
    ['How many kilometres of blood vessels are in a human body?', 'Include the tiny capillaries.', 100000, 10000, 1000000, 'Laid end to end, the network is often estimated at around 100,000 km.'],
    ['How many ants would weigh the same as a person?', 'Use ordinary small garden ants.', 1000000, 10000, 10000000, 'A million ants can add up to roughly the mass of one human.'],
    ['How many years would it take sunlight to reach the nearest star?', 'The Sun is close; the next star is not.', 4.24, 1, 20, 'Proxima Centauri is about 4.24 light-years away.'],
    ['How many litres of water does a person drink in a year?', 'Count drinks, not all the water hidden in food.', 730, 100, 5000, 'Two litres a day is around 730 litres over a year.'],
    ['How many buttons are on a typical astronaut’s spacesuit?', 'Think controls, connectors, and emergency details.', 100, 10, 500, 'The exact count varies, but suits are packed with small controls.'],
    ['How many steps does it take to walk across Manhattan?', 'A long city walk from one end to the other.', 40000, 5000, 200000, 'The distance and city blocks add up to tens of thousands of steps.'],
    ['How many litres of water are in the human body?', 'Roughly half to two-thirds of body mass is water.', 42, 10, 100, 'A 70 kg adult contains around 42 litres of water.'],
    ['How many years ago did the dinosaurs go extinct?', 'Use the end-Cretaceous extinction.', 66000000, 1000000, 200000000, 'The non-avian dinosaurs disappeared about 66 million years ago.'],
    ['How many stars can you see with the naked eye?', 'Think from a very dark place, over the whole sky.', 6000, 100, 100000, 'Only around half the sky is visible at once, but thousands are visible overall.'],
    ['How many tonnes does a blue whale weigh?', 'The biggest animal ever known is hard to picture.', 150, 20, 500, 'Large blue whales can weigh well over 100 tonnes.'],
    ['How many days would it take to count to one million?', 'Count one number every second without sleeping.', 12, 1, 100, 'One million seconds is about 11.6 days.'],
    ['How many kilometres of coastline does Iceland have?', 'Include the bays and fjords.', 5000, 1000, 20000, 'Iceland’s deeply indented coast is roughly 5,000 km long.'],
    ['How many cups of coffee are drunk worldwide each day?', 'Include every café, office, kitchen, and petrol station.', 2000000000, 100000000, 10000000000, 'Around two billion cups are consumed globally each day.'],
    ['How many litres of water fall as rain on Earth each day?', 'Add up every storm and drizzle worldwide.', 1000000000000, 100000000000, 10000000000000, 'The global water cycle moves truly enormous quantities every day.'],
    ['How many kilometres does a house cat walk in a day?', 'Include wandering, exploring, and midnight patrols.', 2, .1, 20, 'Indoor cats may walk less; outdoor cats can cover several kilometres.'],
    ['How many piano notes are in the opening of Beethoven’s Fifth Symphony?', 'Count the famous four-note motif repeated across the opening.', 100, 10, 1000, 'The iconic motif returns more often than the short opening makes you expect.'],
    ['How many litres of paint would cover a football field?', 'One thin coat over the whole playing surface.', 1000, 100, 10000, 'A football field is huge, even when the coat of paint is thin.'],
    ['How many kilometres per hour does a sneeze travel?', 'The answer is fast, but not quite supersonic.', 160, 20, 500, 'Estimates vary, but a forceful sneeze can move droplets very quickly.'],
    ['How many times has the Eiffel Tower been painted?', 'Count its full repainting history since it was built.', 20, 5, 100, 'The tower has been repainted roughly once every seven years.'],
    ['How many kilograms of skin does an adult carry?', 'Your largest organ is heavier than it feels.', 4, 1, 15, 'Skin makes up a significant fraction of body weight.'],
    ['How many litres of water are in a thunderstorm cloud?', 'This is the same idea as the small cloud question, scaled up.', 100000000, 1000000, 1000000000, 'A storm cloud can hold hundreds of millions of litres of water.'],
    ['How many kilometres does a bee fly to make one jar of honey?', 'Add up all the tiny trips between flowers and hive.', 80000, 10000, 500000, 'A worker bee may travel enormous combined distances for a small amount of honey.'],
    ['How many pieces are in a jigsaw puzzle you can finish in an evening?', 'Think a satisfying but not enormous puzzle.', 500, 50, 5000, 'Five hundred pieces is a classic evening-to-weekend puzzle size.'],
    ['How many litres of water are in a watermelon?', 'Use a large supermarket watermelon.', 3, .5, 10, 'Watermelons are mostly water, but the rind and flesh take up space.'],
    ['How many words does a person speak in a day?', 'Include conversations, work, messages spoken aloud, and muttering.', 16000, 1000, 100000, 'The average varies wildly, but many estimates land around 15,000–16,000.'],
    ['How many kilometres away is the International Space Station?', 'It is much closer than the Moon, but still high above us.', 400, 100, 1000, 'The ISS orbits roughly 400 kilometres above Earth.'],
    ['How many grains of rice are in a 1 kg bag?', 'Picture a normal long-grain rice bag.', 50000, 10000, 200000, 'A grain is tiny, but a kilogram contains tens of thousands of them.'],
    ['How many litres of water does a shower use?', 'A normal ten-minute shower, not a power shower.', 100, 10, 500, 'A typical showerhead uses around ten litres per minute.']
  ];
  const localDay = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5;
  const todayNo = localDay(new Date()) - Date.UTC(...LAUNCH) / 864e5 + 1;
  const queryDay = Number.parseInt(new URLSearchParams(location.search).get('day'), 10);
  const day = Number.isFinite(queryDay) && queryDay > 0 ? queryDay : todayNo;
  const dayIndex = ((day - 1) % 50 + 50) % 50;
  const random = seeded(dayIndex * 7919 + 17);
  const order = questions.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const dailyQuestions = order.slice(0, DAILY_COUNT).map(index => questions[index]);
  const key = 'magnitude:v2';
  const format = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: value < 10 ? 1 : 0 });
  let saved = load();
  let results = saved[day]?.results || [];
  let index = results.length;
  $('dayLabel').textContent = `#${day}`;

  function seeded(value) {
    let n = value | 0;
    return () => {
      n = Math.imul(n ^ n >>> 15, 1 | n);
      n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }
  function renderQuestion() {
    const current = dailyQuestions[index];
    if (!current) return finish();
    $('dayCount').textContent = `${index + 1} / ${DAILY_COUNT}`;
    $('question').textContent = current[0];
    $('prompt').textContent = current[1];
    setupSlider(current);
    $('result').hidden = true;
    $('guessForm').hidden = false;
    $('play').querySelector('.title-row').style.opacity = '1';
  }
  function setupSlider(current) {
    const minLog = Math.log10(current[3]);
    const maxLog = Math.log10(current[4]);
    const valueAt = position => Math.pow(10, minLog + (position / 1000) * (maxLog - minLog));
    const positionAt = value => Math.round((Math.log10(value) - minLog) / (maxLog - minLog) * 1000);
    $('minLabel').textContent = format(current[3]);
    $('maxLabel').textContent = format(current[4]);
    $('guess').value = positionAt(Math.sqrt(current[3] * current[4]));
    $('guess').oninput = () => { $('guessValue').textContent = format(valueAt(Number($('guess').value))); };
    $('guess').oninput();
    $('guess').dataset.value = '';
  }
  function currentValue() {
    const current = dailyQuestions[index];
    const minLog = Math.log10(current[3]);
    const maxLog = Math.log10(current[4]);
    return Math.pow(10, minLog + (Number($('guess').value) / 1000) * (maxLog - minLog));
  }
  function load() { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (error) { return {}; } }
  function persist() { try { localStorage.setItem(key, JSON.stringify(saved)); } catch (error) {} }
  function toneFor(error) {
    if (error <= .05) return ['g', 'Nailed it'];
    if (error <= .2) return ['y', 'Very close'];
    if (error <= .5) return ['o', 'Good instinct'];
    return ['r', 'Wild guess'];
  }
  function submit(event) {
    event.preventDefault();
    const guess = currentValue();
    const current = dailyQuestions[index];
    const error = Math.abs(guess - current[2]) / current[2];
    const [tone] = toneFor(error);
    results[index] = { guess, tone, error };
    saved[day] = { results };
    persist();
    showResult(current, guess, tone, error);
  }
  function showResult(current, guess, tone, error) {
    const [, label] = toneFor(error);
    $('actual').textContent = format(current[2]);
    $('grade').className = `grade ${tone}`;
    $('grade').textContent = label;
    $('distance').textContent = `${error < .01 ? 'Almost exact.' : `${Math.round(error * 100)}% away from the real answer.`} Your guess was ${format(guess)}.`;
    $('explanation').textContent = current[5];
    $('guessForm').hidden = true;
    $('result').hidden = false;
    $('next').textContent = index + 1 < DAILY_COUNT ? 'Next estimate' : 'See today’s results';
  }
  function next() {
    index += 1;
    if (index >= DAILY_COUNT) finish();
    else renderQuestion();
  }
  function finish() {
    $('play').hidden = true;
    $('end').hidden = false;
    const points = results.reduce((sum, result) => sum + (result?.tone === 'g' ? 100 : result?.tone === 'y' ? 70 : result?.tone === 'o' ? 40 : 10), 0);
    $('endDay').textContent = `#${day}`;
    $('total').innerHTML = `${points}<small> / ${DAILY_COUNT * 100}</small>`;
    $('resultDots').innerHTML = results.slice(0, DAILY_COUNT).map(result => `<span class="result-dot ${result?.tone || 'r'}"></span>`).join('');
    $('summary').textContent = 'The closer your five guesses, the better calibrated your intuition.';
    $('tomorrow').textContent = 'A new estimate arrives tomorrow.';
    $('share').onclick = () => share(results);
  }
  async function share(dayResults) {
    const text = `Magnitude #${day} ${dayResults.map(result => ({ g: '🟩', y: '🟨', o: '🟧', r: '🟥' }[result?.tone] || '⬜')).join('')}\noli.is/daily.html`;
    try { await navigator.clipboard.writeText(text); $('share').textContent = 'Copied result!'; }
    catch (copyError) { $('share').textContent = text; }
  }
  $('guessForm').addEventListener('submit', submit);
  $('next').addEventListener('click', next);
  if (index >= DAILY_COUNT) finish();
  else {
    renderQuestion();
    if (results[index]) {
      const current = dailyQuestions[index];
      showResult(current, results[index].guess, results[index].tone, results[index].error);
    }
  }
})();
