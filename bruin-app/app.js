// Application version — increment this when you deploy changes to force clients
// to clear local cache/storage and cookies. Example: '2026-05-13-1'
const APP_VERSION = '2026-05-13-1';

// If the stored version differs, reset storage and cookies so clients get a clean state
try {
  const storedVersion = localStorage.getItem('bruinAppVersion');
  if (storedVersion !== APP_VERSION) {
    // clear storage
    localStorage.clear();
    sessionStorage.clear();
    // clear all cookies for current path/domain
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (!name) return;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${location.hostname}`;
    });
    // mark version so we don't clear again on the same deployed version
    localStorage.setItem('bruinAppVersion', APP_VERSION);
    // reload so the app re-initializes with cleared storage
    location.reload();
  }
} catch (e) {
  // fail silently; do not block app
  console.warn('Version check failed', e);
}

const people = [
  {
    name: "Sigríður Árnadóttir",
    initials: "SÁ",
    image: "assets/woman_1.jpeg",
    age: "26-45",
    location: "Reykjavík",
    interests: ["Göngur", "Ljósmyndun", "Kaffi"],
    note: "3 sameiginleg áhugamál"
  },
  {
    name: "Jón Þórsson",
    initials: "JÞ",
    image: "assets/man_1.jpeg",
    age: "46+",
    location: "Kópavogur",
    interests: ["Líkamsrækt", "Matargerð", "Tónlist"],
    note: "2 sameiginleg áhugamál"
  },
  {
    name: "Emma Jónsdóttir",
    initials: "EJ",
    image: "assets/woman_2.jpeg",
    age: "18-25",
    location: "Hafnarfjörður",
    interests: ["Spil", "Kaffi", "Ferðalög"],
    note: "4 sameiginleg áhugamál"
  },
  {
    name: "Kristján Helgason",
    initials: "KH",
    image: "assets/man_2.jpeg",
    age: "46+",
    location: "Garðabær",
    interests: ["Golf", "Kaffi", "Göngur"],
    note: "2 sameiginleg áhugamál"
  },
  {
    name: "Diljá Rún",
    initials: "DR",
    image: "assets/woman_3.jpeg",
    age: "18-25",
    location: "Reykjavík",
    interests: ["Dans", "Tónlist", "Kvikmyndir"],
    note: "3 sameiginleg áhugamál"
  },
  {
    name: "Margrét Líf",
    initials: "ML",
    image: "assets/man_3.jpeg",
    age: "46+",
    location: "Mosfellsbær",
    interests: ["Garðyrkja", "Bóklestur", "Matargerð"],
    note: "2 sameiginleg áhugamál"
  }
];

const allInterests = [
  "Göngur",
  "Kaffi",
  "Spil",
  "Golf",
  "Ljósmyndun",
  "Matargerð",
  "Tónlist",
  "Líkamsrækt",
  "List",
  "Bóklestur",
  "Ferðalög",
  "Hjólreiðar",
  "Jóga",
  "Dans",
  "Kvikmyndir",
  "Tölvuleikir",
  "Útivist",
  "Hlaupa",
  "Sund",
  "Prjón",
  "Garðyrkja",
  "Leikhús",
  "Sjósund",
  "Pílukast",
  "Skák",
  "Spjall",
  "Náttúra",
  "Tækni"
];

let events = [
  {
    id: "coffee-downtown",
    title: "Kaffihittingur í miðbænum",
    type: "Inni",
    age: "Allir",
    time: "Í dag · 16:30",
    place: "Reykjavík Roasters",
    attendees: 6,
    host: "Anna",
    image: "coffee",
    interests: ["Ljósmyndun", "Kaffi"],
    description: "Stuttur og afslappaður hittingur fyrir fólk sem vill taka fyrsta skrefið."
   ,
    attendeesList: ["Sigríður Árnadóttir","Jón Þórsson","Emma Jónsdóttir","Kristján Helgason","Diljá Rún","Margrét Líf"]
  },
  {
    id: "ellidaardalur-walk",
    title: "Gönguferð við Elliðaárdal",
    type: "Úti",
    age: "26-45",
    time: "Á morgun · 18:00",
    place: "Rafstöðvarvegur",
    attendees: 9,
    host: "Helga",
    image: "walk",
    interests: ["Göngur", "Útivist"],
    description: "Létt ganga, hópstjóri á staðnum og allir kynna sig í byrjun."
   ,
    attendeesList: ["Emma Jónsdóttir","Sigríður Árnadóttir","Kristján Helgason","Margrét Líf","Jón Þórsson","Diljá Rún","Unknown Person","Another Person","Someone Else"]
  },
  {
    id: "hr-games",
    title: "Spilakvöld í HR",
    type: "Inni",
    age: "18-25",
    time: "Fimmtudagur · 19:30",
    place: "Sólin, HR",
    attendees: 12,
    host: "Sara",
    image: "games",
    interests: ["Spil", "Kaffi"],
    description: "Borðspil, teymi og engin krafa um að þekkja neinn fyrirfram."
   ,
    attendeesList: ["Jón Þórsson","Emma Jónsdóttir","Sigríður Árnadóttir","Someone Else"]
  },
  {
    id: "golf-coffee",
    title: "Golf og kaffi",
    type: "Úti",
    age: "46+",
    time: "Laugardagur · 10:00",
    place: "Básar, Grafarholt",
    attendees: 5,
    host: "Kristján",
    image: "golf",
    interests: ["Golf", "Kaffi"],
    description: "Byrjendavænn hittingur með sameiginlegu kaffi eftir æfingu."
   ,
    attendeesList: ["Kristján Helgason","Margrét Líf"]
  },
  {
    id: "photo-harbor",
    title: "Ljósmyndaganga við höfnina",
    type: "Úti",
    age: "Allir",
    time: "Miðvikudagur · 17:45",
    place: "Harpa",
    attendees: 7,
    host: "Sigríður",
    image: "photo",
    interests: ["Ljósmyndun", "Göngur"],
    description: "Róleg myndaganga þar sem allir velja eina uppáhaldsmynd í lokin."
   ,
    attendeesList: ["Sigríður Árnadóttir","Emma Jónsdóttir","Diljá Rún","Someone Else"]
  },
  {
    id: "soup-stories",
    title: "Súpa og sögur",
    type: "Inni",
    age: "46+",
    time: "Sunnudagur · 12:30",
    place: "Grandi Mathöll",
    attendees: 8,
    host: "Margrét",
    image: "food",
    interests: ["Matargerð", "Spjall"],
    description: "Hádegishittingur með einfaldri dagskrá og borði fráteknu fyrir hópinn."
   ,
    attendeesList: ["Margrét Líf","Kristján Helgason"]
  },
  {
    id: "music-listening",
    title: "Tónlistarkvöld",
    type: "Inni",
    age: "26-45",
    time: "Föstudagur · 20:00",
    place: "Kex Hostel",
    attendees: 10,
    host: "Jón",
    image: "music",
    interests: ["Tónlist", "Kaffi"],
    description: "Allir koma með eitt lag og segja stutt frá því af hverju það skiptir máli."
   ,
    attendeesList: ["Jón Þórsson","Emma Jónsdóttir","Sigríður Árnadóttir","Someone Else","Another Person"]
  },
  {
    id: "morning-yoga",
    title: "Morgunjóga og kaffi",
    type: "Úti",
    age: "Allir",
    time: "Laugardagur · 09:30",
    place: "Klambratún",
    attendees: 6,
    host: "Emma",
    image: "yoga",
    interests: ["Jóga", "Kaffi"],
    description: "Mjúk byrjun á deginum, engin reynsla nauðsynleg og kaffi eftir tímann."
   ,
    attendeesList: ["Emma Jónsdóttir","Diljá Rún","Margrét Líf"]
  }
];

const savedEvents = localStorage.getItem("bruinEvents");
if (savedEvents) {
  events = JSON.parse(savedEvents);
}

const imageThemes = {
  walk: ["#b9d7f0", "#557b5f", "#273d52", "M12 130 C70 72 118 88 178 36 C238 92 294 54 348 118 L348 170 L12 170 Z"],
  coffee: ["#f6d9a8", "#9a6641", "#3d2924", "M72 72 C100 35 154 35 178 74 C204 47 270 54 284 96 C248 128 122 142 72 112 Z"],
  games: ["#5941a9", "#cf49a0", "#ffc65a", "M72 116 L132 58 L200 122 L270 70 L318 132 L318 170 L72 170 Z"],
  golf: ["#cce889", "#3b8a63", "#315b87", "M30 132 C96 78 152 126 206 82 C252 46 308 82 340 130 L340 170 L30 170 Z"],
  photo: ["#8fc7e8", "#5b6fb4", "#302a4f", "M70 62 H278 A18 18 0 0 1 296 80 V144 H52 V80 A18 18 0 0 1 70 62 Z"],
  food: ["#f5bd71", "#cb6550", "#4a2e36", "M72 118 C92 68 146 52 182 92 C218 48 278 70 294 122 C242 152 128 152 72 118 Z"],
  music: ["#7d55c7", "#ef4f9c", "#232342", "M106 50 H246 V70 H126 V134 A28 28 0 1 1 106 108 Z"],
  yoga: ["#ffb36d", "#e45ca0", "#553d91", "M82 128 C128 84 146 84 178 124 C210 84 236 82 294 128 L312 168 H62 Z"]
};

// photo assets pool for activities (used deterministically per event to avoid repeats)
const activityAssets = [
  'assets/activity_1.jpg',
  'assets/activity_2.jpeg',
  'assets/activity_3.jpeg',
  'assets/activity_4.jpeg',
  'assets/activity_5.jpeg',
  'assets/activity_6.jpg'
];

// persistent mapping of event.id -> chosen asset to avoid repeats and keep stability
let eventAssetsMap = JSON.parse(localStorage.getItem('bruinEventAssets') || '{}');

function saveEventAssetsMap() {
  localStorage.setItem('bruinEventAssets', JSON.stringify(eventAssetsMap));
}

function ensureEventAssets() {
  // assign assets to events that don't have one yet; try to maximize unique usage
  const used = new Set(Object.values(eventAssetsMap));
  let assetIndex = 0;
  for (const ev of events) {
    if (!eventAssetsMap[ev.id]) {
      // find first unused asset starting from assetIndex
      let found = null;
      for (let i = 0; i < activityAssets.length; i++) {
        const idx = (assetIndex + i) % activityAssets.length;
        const candidate = activityAssets[idx];
        if (!used.has(candidate)) {
          found = candidate;
          assetIndex = idx + 1;
          break;
        }
      }
      if (!found) {
        // all assets used; assign round-robin
        found = activityAssets[assetIndex % activityAssets.length];
        assetIndex++;
      }
      eventAssetsMap[ev.id] = found;
      used.add(found);
    }
  }
  saveEventAssetsMap();
}

let activeInterest = "all";
let eventMode = "all";
let joinedEvents = new Set(JSON.parse(localStorage.getItem("bruinJoinedEvents") || '["ellidaardalur-walk","hr-games"]'));
let myInterests = JSON.parse(localStorage.getItem("bruinMyInterests") || '["Göngur","Ljósmyndun","Kaffi","Matargerð","Tónlist"]');
myInterests.forEach((interest) => {
  if (!allInterests.includes(interest)) allInterests.push(interest);
});
let myFriends = JSON.parse(localStorage.getItem("bruinFriends") || '[]');

const tabs = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const peopleList = document.querySelector("#peopleList");
const discoverChips = document.querySelector("#discoverChips");
const eventList = document.querySelector("#eventList");
const searchInput = document.querySelector("#searchInput");
const ageFilter = document.querySelector("#ageFilter");
const typeFilter = document.querySelector("#typeFilter");
const toast = document.querySelector("#toast");
const eventModes = document.querySelectorAll(".event-mode");
const eventModal = document.querySelector("#eventModal");
const eventForm = document.querySelector("#eventForm");
const eventInterestSelect = document.querySelector("#eventInterestSelect");
const eventInterestChips = document.querySelector("#eventInterestChips");
let activeEventInterest = 'All';
const myInterestsList = document.querySelector("#myInterests");
const availableInterestsList = document.querySelector("#availableInterests");
const interestForm = document.querySelector("#interestForm");
const eventDetailViewContent = document.getElementById('eventDetailViewContent');
const userViewContent = document.getElementById('userViewContent');
const backFromEventBtn = document.getElementById('backFromEvent');
const backFromUserBtn = document.getElementById('backFromUser');
const friendsCountEl = document.getElementById('friendsCount');
const joinedEventsList = document.getElementById('joinedEventsList');
const subscribeButton = document.getElementById('subscribeButton');
const premiumBadgeEl = document.getElementById('premiumBadge');

// Helper: enable pointer-drag horizontal scrolling on an element (works for touch and mouse)
function enableDragScroll(el) {
  if (!el) return;
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let moved = false;

  el.addEventListener('pointerdown', (e) => {
    isDown = true;
    moved = false;
    startX = e.clientX;
    scrollLeft = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  }, { passive: true });

  el.addEventListener('pointermove', (e) => {
    if (!isDown) return;
    const dx = startX - e.clientX;
    if (Math.abs(dx) > 2) moved = true;
    el.scrollLeft = scrollLeft + dx;
  }, { passive: true });

  const up = (e) => {
    if (!isDown) return;
    isDown = false;
    try { el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch (err) {}
    // if we moved, prevent click events from firing on the child that started the drag
    if (moved) {
      const preventClick = (ev) => { ev.stopImmediatePropagation(); ev.preventDefault(); };
      // one-time capture: run on next microtask for any click
      window.setTimeout(() => {
        el.addEventListener('click', preventClick, { once: true, capture: true });
      }, 0);
    }
  };

  el.addEventListener('pointerup', up, { passive: true });
  el.addEventListener('pointercancel', up, { passive: true });
}

// Attach drag-scroll to chips used on Discover and Events
enableDragScroll(discoverChips);
enableDragScroll(eventInterestChips);

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetView = tab.dataset.view;
    // require login for all views except the login view itself
    const user = getUser();
    if (!user && targetView !== 'login') {
      showToast('Skráðu þig inn til að halda áfram.');
      showLoginModal();
      return;
    }
    showView(targetView);
  });
});

eventModes.forEach((button) => {
  button.addEventListener("click", () => {
    eventMode = button.dataset.eventMode;
    eventModes.forEach((item) => item.classList.toggle("active", item === button));
    renderEvents();
  });
});

searchInput.addEventListener("input", renderPeople);
ageFilter.addEventListener("change", renderEvents);
typeFilter.addEventListener("change", renderEvents);
interestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = interestForm.elements.interest;
  const interest = normalizeInterest(input.value);
  if (!interest) return;
  addInterest(interest);
  input.value = "";
});

document.querySelector("#createEvent").addEventListener("click", openModal);
document.querySelector("#closeModal").addEventListener("click", closeModal);
eventModal.addEventListener("click", (event) => {
  if (event.target === eventModal) closeModal();
});
// detail modal removed; navigation uses views instead

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(eventForm);
  const newEvent = {
    id: `created-${Date.now()}`,
    title: data.get("title").trim(),
    type: data.get("type"),
    age: data.get("age"),
    time: data.get("time").trim(),
    place: data.get("place").trim(),
    attendees: 1,
    host: "Þú",
    image: data.get("image"),
    interests: [data.get("interest") || imageLabel(data.get("image"))],
    description: data.get("description").trim(),
    createdByMe: true
    , attendeesList: [getCurrentUserName() || 'Þú']
  };

  events = [newEvent, ...events];
  joinedEvents.add(newEvent.id);
  saveState();
  eventMode = "mine";
  eventModes.forEach((item) => item.classList.toggle("active", item.dataset.eventMode === "mine"));
  eventForm.reset();
  closeModal();
  showView("events");
  updateJoinedCount();
  renderEvents();
  showToast("Viðburður búinn til og þú ert skráð/ur.");
});

function renderPeople() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = people.filter((person) => {
    const interestMatch = activeInterest === "all" || person.interests.includes(activeInterest);
    const text = [person.name, person.location, person.note, ...person.interests].join(" ").toLowerCase();
    return interestMatch && text.includes(query);
  });

  peopleList.innerHTML = filtered.map((person) => `
    <article class="person" data-person="${person.name}">
      <div class="person-avatar" aria-hidden="true">${person.image ? `<img src="${person.image}" alt="${person.name}">` : person.initials}</div>
      <div>
        <h3>${person.name}</h3>
        <div class="meta">
          <span>⌖ ${person.location}</span>
          <span>♙ ${person.note}</span>
        </div>
        <div class="tags">${person.interests.map((interest) => `<span>${interest}</span>`).join("")}</div>
        <div class="person-actions">
          <button class="primary" type="button" data-friend-add="${person.name}">${myFriends.includes(person.name) ? 'Vinur' : 'Tengjast ✨'}</button>
        </div>
      </div>
    </article>
  `).join("");

  peopleList.querySelectorAll("[data-friend-add]").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = button.dataset.friendAdd;
      if (myFriends.includes(name)) {
        removeFriend(name);
        button.textContent = 'Tengjast ✨';
      } else {
        addFriend(name);
        button.textContent = 'Vinur';
      }
    });
  });

  peopleList.querySelectorAll("[data-person]").forEach((el) => {
    el.addEventListener("click", () => openUserView(el.dataset.person));
  });
}

function renderEventInterestChips() {
  if (!eventInterestChips) return;
  const unique = Array.from(new Set([...(myInterests || []), ...allInterests]));
  const items = [{ v: 'All', t: 'Allt' }, { v: 'mine-interests', t: 'Mín áhugamál' }].concat(unique.map(i => ({ v: i, t: displayInterest(i) })));
  const onlyMy = activeEventInterest === 'mine-interests';
  eventInterestChips.innerHTML = items.map(it => {
    const isActive = (onlyMy && it.v === 'mine-interests') || (activeEventInterest === it.v);
    const active = isActive ? 'active' : '';
    return `<button class="chip ${active}" type="button" data-event-interest="${it.v}">${it.t}</button>`;
  }).join('');

  // wire chip handlers
  eventInterestChips.querySelectorAll('[data-event-interest]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.eventInterest;
      if (val === 'mine-interests') {
        // toggle only-my mode
        activeEventInterest = activeEventInterest === 'mine-interests' ? 'All' : 'mine-interests';
      } else {
        // selecting any other chip clears the only-my toggle
        if (activeEventInterest === val) activeEventInterest = 'All'; else activeEventInterest = val;
      }
      renderEventInterestChips();
      renderEvents();
    });
  });
}

// Note: only-my toggle removed; chips (`mine-interests`) are the single control.

function renderDiscoverChips() {
  const chipInterests = ["all", ...allInterests];
  discoverChips.innerHTML = chipInterests.map((interest) => {
    const label = interest === "all" ? "Allt" : displayInterest(interest);
    const active = activeInterest === interest ? "active" : "";
    return `<button class="chip ${active}" type="button" data-interest="${interest}">${label}</button>`;
  }).join("");

  discoverChips.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeInterest = chip.dataset.interest;
      renderDiscoverChips();
      renderPeople();
    });
  });
}

function renderProfileInterests() {
  myInterestsList.innerHTML = myInterests.map((interest) => `
    <button type="button" data-remove-interest="${interest}">${displayInterest(interest)} ×</button>
  `).join("");

  myInterestsList.querySelectorAll("[data-remove-interest]").forEach((button) => {
    button.addEventListener("click", () => {
      const removed = button.dataset.removeInterest;
      myInterests = myInterests.filter((interest) => interest !== removed);
      saveState();
      renderProfileInterests();
      renderAvailableInterests();
      syncInterestControls();
      showToast(`${displayInterest(removed)} fjarlægt.`);
    });
  });
}

function renderAvailableInterests() {
  const available = allInterests.filter((interest) => !myInterests.includes(interest));
  availableInterestsList.innerHTML = available.map((interest) => `
    <button type="button" data-add-interest="${interest}">+ ${displayInterest(interest)}</button>
  `).join("");

  availableInterestsList.querySelectorAll("[data-add-interest]").forEach((button) => {
    button.addEventListener("click", () => addInterest(button.dataset.addInterest));
  });
}

function renderEventInterestOptions() {
  const options = [...new Set([...myInterests, ...allInterests])];
  eventInterestSelect.innerHTML = options.map((interest) => `
    <option value="${interest}">${displayInterest(interest)}</option>
  `).join("");
}

// keep the event interest filter in sync with profile interests
function syncInterestControls() {
  renderEventInterestOptions();
  renderEventInterestChips();
}

function addInterest(interest) {
  if (!allInterests.includes(interest)) {
    allInterests.push(interest);
  }
  if (myInterests.includes(interest)) {
    showToast(`${displayInterest(interest)} er nú þegar valið.`);
    return;
  }

  myInterests = [...myInterests, interest];
  saveState();
  renderDiscoverChips();
  renderProfileInterests();
  renderAvailableInterests();
  syncInterestControls();
  showToast(`${displayInterest(interest)} bætt við.`);
}

function renderEvents() {
  const age = ageFilter.value;
  const type = typeFilter.value;
  const interestSel = typeof activeEventInterest !== 'undefined' ? activeEventInterest : 'All';
  const onlyMy = activeEventInterest === 'mine-interests';
  const filtered = events.filter((event) => {
    const ageMatch = age === "Allir" || event.age === "Allir" || event.age === age;
    const typeMatch = type === "Allt" || event.type === type;
    let modeMatch;
    if (eventMode === "all") {
      modeMatch = true;
    } else if (eventMode === "mine") {
      // show only events the user created
      modeMatch = !!event.createdByMe;
    } else {
      modeMatch = true;
    }
    // interest filter: toggle takes precedence
    let interestMatch = true;
    if (onlyMy) {
      interestMatch = Array.isArray(event.interests) && event.interests.some(i => myInterests.includes(i));
    } else if (interestSel && interestSel !== 'All') {
      interestMatch = Array.isArray(event.interests) && event.interests.includes(interestSel);
    }

    return ageMatch && typeMatch && modeMatch && interestMatch;
  });

  if (filtered.length === 0) {
    eventList.innerHTML = `
      <section class="empty-state">
        <strong>Engir viðburðir hér enn</strong>
        <p>Skráðu þig á viðburð eða búðu til nýjan.</p>
        <button class="create-button" type="button" data-empty-create>+ Búa til</button>
      </section>
    `;
    eventList.querySelector("[data-empty-create]").addEventListener("click", openModal);
    return;
  }

  eventList.innerHTML = filtered.map((event) => {
    const joined = joinedEvents.has(event.id);
    return `
      <article class="event-card" data-event-card="${event.id}" tabindex="0" role="button" aria-label="Skoða ${event.title}">
        <div class="event-image">
          <img src="${eventImage(event.image, event.id)}" alt="">
          <span class="badge">${event.interests[0]}</span>
          ${event.createdByMe ? '<span class="owner-badge">Þinn</span>' : ""}
        </div>
        <div class="event-body">
          <h3>${event.title}</h3>
          <div class="event-meta">
            <span>▣ ${event.time}</span>
            <span>⌖ ${event.place}</span>
            <span>♙ ${event.attendees}/12 mæta</span>
          </div>
          <p>${event.description}</p>
          <div class="event-actions">
            <button class="primary ${joined ? "joined" : ""}" type="button" data-join="${event.id}">
              ${joined ? "Skráð/ur ✓" : "Mæti! ✓"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  eventList.querySelectorAll("[data-join]").forEach((button) => {
    button.addEventListener("click", (clickEvent) => {
      clickEvent.stopPropagation();
      const event = events.find((item) => item.id === button.dataset.join);
      toggleEventJoin(event);
    });
  });

  eventList.querySelectorAll("[data-event-card]").forEach((card) => {
    card.addEventListener("click", () => openEventView(card.dataset.eventCard));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openEventView(card.dataset.eventCard);
      }
    });
  });
}

function openEventView(eventId) {
  const event = events.find((item) => item.id === eventId);
  if (!event) return;
  const joined = joinedEvents.has(event.id);
  const attendees = Array.isArray(event.attendeesList) ? event.attendeesList.slice(0, 12) : [];
  const attendeesHtml = attendees.map((name) => {
    const personObj = people.find(p => p.name === name);
    const initials = name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
    const avatar = personObj && personObj.image
      ? `<div class="person-avatar" aria-hidden="true"><img src="${personObj.image}" alt="${name}"></div>`
      : `<div class="person-avatar" aria-hidden="true">${initials}</div>`;
    return `<button class="chip attendee" type="button" data-attendee="${name}">${avatar} ${name}</button>`;
  }).join("");

  eventDetailViewContent.innerHTML = `
    <div class="detail-image">
      <img src="${eventImage(event.image, event.id)}" alt="">
      <span class="badge">${event.interests[0]}</span>
      ${event.createdByMe ? '<span class="owner-badge">Þinn</span>' : ""}
    </div>
    <div class="detail-body">
      <h2 id="detailTitle">${event.title}</h2>
      <p>${event.description}</p>
      <div class="detail-info">
        <article><span>▣</span><div><strong>Tími</strong><small>${event.time}</small></div></article>
        <article><span>⌖</span><div><strong>Staður</strong><small>${event.place}</small></div></article>
        <article><span>♙</span><div><strong>Þátttakendur</strong><small>${event.attendees}/12 mæta</small></div></article>
        <article><span>✓</span><div><strong>Hópstjóri</strong><small>${event.host}</small></div></article>
      </div>
      <div class="tags detail-tags">${event.interests.map((interest) => `<span>${displayInterest(interest)}</span>`).join("")}</div>
      <div style="margin:12px 0"><strong>Það koma:</strong></div>
      <div class="chips attendees-list">${attendeesHtml || '<span class="muted">Engir skráðir enn</span>'}</div>
      <button class="primary detail-join ${joined ? "joined" : ""}" type="button" data-detail-join="${event.id}">
        ${joined ? "Afskrá mig" : "Skrá mig á viðburð"}
      </button>
    </div>
  `;

  // attach handlers
  const joinBtn = eventDetailViewContent.querySelector('[data-detail-join]');
  if (joinBtn) joinBtn.addEventListener('click', () => { toggleEventJoin(event); openEventView(event.id); });

  eventDetailViewContent.querySelectorAll('[data-attendee]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      openUserView(btn.dataset.attendee);
      e.stopPropagation();
    });
  });

  // navigate to the event detail view
  showView('eventDetailView');
}

// detail modal removed; no-op

function toggleEventJoin(event) {
  const me = getCurrentUserName() || "Þú";
  if (!Array.isArray(event.attendeesList)) event.attendeesList = [];
  if (joinedEvents.has(event.id)) {
    joinedEvents.delete(event.id);
    event.attendees = Math.max(1, event.attendees - 1);
    // remove user from attendeesList
    const idx = event.attendeesList.indexOf(me);
    if (idx !== -1) event.attendeesList.splice(idx, 1);
    showToast(`Þú ert ekki lengur skráð/ur á ${event.title}.`);
  } else {
    joinedEvents.add(event.id);
    event.attendees += 1;
    // add user to attendeesList if not present
    if (!event.attendeesList.includes(me)) event.attendeesList.unshift(me);
    showToast(`Þú ert skráð/ur á ${event.title}.`);
  }
  saveState();
  updateJoinedCount();
  renderEvents();
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function eventImage(type, id) {
  // prefer a previously assigned asset for this event
  if (id && eventAssetsMap[id]) return eventAssetsMap[id];
  // if no mapping yet, fall back to deterministic hash selection
  if (id) {
    const idx = Math.abs(hashCode(id)) % activityAssets.length;
    return activityAssets[idx];
  }
  // fallback: try a photo by type if we had one, otherwise SVG theme
  const [sky, land, dark, path] = imageThemes[type] || imageThemes.walk;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 190">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${sky}"/>
          <stop offset="0.58" stop-color="${land}"/>
          <stop offset="1" stop-color="${dark}"/>
        </linearGradient>
        <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="white" stop-opacity="0.38"/>
          <stop offset="1" stop-color="white" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="360" height="190" fill="url(#bg)"/>
      <circle cx="286" cy="42" r="24" fill="#ffd86c" opacity="0.9"/>
      <path d="${path}" fill="rgba(255,255,255,0.28)"/>
      <path d="M0 132 C70 100 112 154 180 120 C240 90 296 118 360 92 L360 190 L0 190 Z" fill="rgba(20,22,38,0.28)"/>
      <path d="M0 0 H360 V92 C280 70 210 102 132 76 C76 56 34 66 0 84 Z" fill="url(#shine)"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function imageLabel(type) {
  const labels = {
    walk: "Göngur",
    coffee: "Kaffi",
    games: "Spil",
    golf: "Golf",
    photo: "Ljósmyndun",
    food: "Matargerð",
    music: "Tónlist",
    yoga: "Jóga"
  };
  return labels[type] || "Hittingur";
}

function displayInterest(interest) {
  const labels = {
    Göngur: "Gönguferðir"
  };
  return labels[interest] || interest;
}

function normalizeInterest(value) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function showView(viewName) {
  tabs.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  views.forEach((view) => view.classList.toggle("active", view.id === viewName));
  // when opening profile, render the friend preview; otherwise ensure friend footer is removed
  if (viewName === 'profile') renderFriendList();
}

function openModal() {
  eventModal.classList.add("show");
  eventModal.setAttribute("aria-hidden", "false");
  eventForm.elements.title.focus();
}

function closeModal() {
  eventModal.classList.remove("show");
  eventModal.setAttribute("aria-hidden", "true");
}

function updateJoinedCount() {
  const el = document.getElementById('joinedCount');
  if (el) el.textContent = joinedEvents.size;
}

function updateProfileStats() {
  if (friendsCountEl) friendsCountEl.textContent = myFriends.length;
  updateJoinedCount();
}

function renderJoinedEvents() {
  if (!joinedEventsList) return;
  const joined = events.filter(e => joinedEvents.has(e.id));
  if (joined.length === 0) {
    joinedEventsList.innerHTML = `
      <div class="empty-state">
        <strong>Engir skráðir viðburðir</strong>
        <p>Skráðu þig á viðburð eða skoðaðu alla viðburði.</p>
        <button type="button" class="create-button" data-view-events>Fara á viðburði</button>
      </div>
    `;
    const btn = joinedEventsList.querySelector('[data-view-events]');
    if (btn) btn.addEventListener('click', () => showView('events'));
    return;
  }

  joinedEventsList.innerHTML = joined.map((event) => `
    <article class="event-card" data-joined-event="${event.id}">
      <div class="event-body">
        <h3>${event.title}</h3>
        <div class="event-meta"><span>▣ ${event.time}</span><span>⌖ ${event.place}</span></div>
      </div>
    </article>
  `).join('');

  joinedEventsList.querySelectorAll('[data-joined-event]').forEach((el) => {
    el.addEventListener('click', () => openEventView(el.dataset.joinedEvent));
  });
}

function saveState() {
  // ensure we have assigned assets for any new events before saving
  ensureEventAssets();
  localStorage.setItem("bruinEvents", JSON.stringify(events));
  localStorage.setItem("bruinJoinedEvents", JSON.stringify([...joinedEvents]));
  localStorage.setItem("bruinMyInterests", JSON.stringify(myInterests));
  localStorage.setItem("bruinFriends", JSON.stringify(myFriends));
  // persist event->asset map
  saveEventAssetsMap();
  // update UI counts
  updateProfileStats();
  renderJoinedEvents();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

renderDiscoverChips();
renderPeople();
renderProfileInterests();
renderAvailableInterests();
syncInterestControls();
updateJoinedCount();
// make sure events have assigned images before rendering
ensureEventAssets();
renderEvents();
updateProfileStats();
renderJoinedEvents();
        
// ---- Simple client-side login (first-visit) ----
const loginView = document.getElementById("login");
const loginForm = document.getElementById("loginForm");
const logoutButton = document.getElementById("logoutButton");

function setLogoutVisibility(visible) {
  if (!logoutButton) return;
  logoutButton.style.display = visible ? "block" : "none";
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("bruinUser"));
  } catch (e) {
    return null;
  }
}

function getCurrentUserName() {
  const user = getUser();
  return user && user.name ? user.name : null;
}

function addUserToJoinedEvents(userName) {
  if (!userName) return;
  let changed = false;
  joinedEvents.forEach((eventId) => {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    if (!Array.isArray(ev.attendeesList)) ev.attendeesList = [];
    if (!ev.attendeesList.includes(userName)) {
      ev.attendeesList.push(userName);
      ev.attendees = (typeof ev.attendees === 'number' ? ev.attendees : ev.attendeesList.length) + 0;
      changed = true;
    }
  });
  if (changed) saveState();
}

function applyUserToUI(user) {
  if (!user) return;
  const initialsEl = document.querySelector(".profile-photo");
  const profileNameEl = document.querySelector("#profile-title");
  const initials = user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (initialsEl) initialsEl.textContent = initials;
  if (profileNameEl) profileNameEl.textContent = user.name;
  setLogoutVisibility(true);
  // show premium badge if user has premium flag
  try {
    const stored = JSON.parse(localStorage.getItem('bruinUser') || 'null');
    const isPremium = stored && stored.premium;
    if (premiumBadgeEl) premiumBadgeEl.style.display = isPremium ? 'inline-block' : 'none';
    // update subscribe button text
    if (subscribeButton) subscribeButton.textContent = isPremium ? 'Hætta í Premium' : 'Gerast Premium';
  } catch (e) {
    if (premiumBadgeEl) premiumBadgeEl.style.display = 'none';
    if (subscribeButton) subscribeButton.textContent = 'Gerast Premium';
  }
}

function showLoginModal() {
  // open the login view like other views
  if (!loginView) return;
  showView('login');
  // focus the username field if present
  const input = loginView.querySelector('input[name="username"]');
  if (input) input.focus();
}

function hideLoginModal() {
  // after successful login, navigate to main discover view
  showView('discover');
}

function renderLoginInterests() {
  const container = document.getElementById("loginInterests");
  if (!container) return;
  container.innerHTML = allInterests.map((interest) => `
    <label class="login-interest">
      <input type="checkbox" name="interest" value="${interest}">
      <span>${displayInterest(interest)}</span>
    </label>
  `).join("");
}

if (loginForm) {
  renderLoginInterests();
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (loginForm.elements.username.value || "").trim();
    if (!name) return;
    const selected = Array.from(loginForm.querySelectorAll('input[name="interest"]:checked')).map((i) => i.value);
    if (selected.length === 0) {
      showToast("Veldu að minnsta kosti eitt áhugamál.");
      return;
    }

    // persist user and interests
      localStorage.setItem("bruinUser", JSON.stringify({ name, interests: selected }));
      myInterests = selected.slice();
      // clear friends for new user
      myFriends = [];
      localStorage.setItem('bruinFriends', JSON.stringify(myFriends));
      // ensure this user appears in any events already marked as joined
      addUserToJoinedEvents(name);
      saveState();
    applyUserToUI({ name });
    setLogoutVisibility(true);
    renderDiscoverChips();
    renderProfileInterests();
    renderAvailableInterests();
    syncInterestControls();
    renderPeople();
    hideLoginModal();
    showToast(`Velkomin/n, ${name.split(" ")[0]}!`);
  });
}

// Subscribe flow: mark current user as premium
if (subscribeButton) {
  subscribeButton.addEventListener('click', () => {
    const user = getUser();
    if (!user) {
      showToast('Skráðu þig inn til að gerast Premium.');
      showLoginModal();
      return;
    }
    // toggle premium
    user.premium = !user.premium;
    localStorage.setItem('bruinUser', JSON.stringify(user));
    applyUserToUI(user);
    if (user.premium) {
      subscribeButton.textContent = 'Hætta í Premium';
      showToast('Takk! Þú ert nú Premium.');
    } else {
      subscribeButton.textContent = 'Gerast Premium';
      showToast('Þú hefur hætt í Premium.');
    }
  });
}

// ---- Friends and user profiles ----
// user modal removed; we render into userViewContent and use back button

function renderFriendList() {
  const container = document.getElementById('friendList');
  if (!container) return;

  // if profile view is active and no explicit full render requested, show a small preview
  const profileView = document.getElementById('profile');
  const profileActive = profileView && profileView.classList.contains('active');
  const previewLimit = profileActive ? 4 : null;

  if (myFriends.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Engir vinir enn — tengstu fólki!</p></div>';
    return;
  }

  const limit = previewLimit;
  const friendsToShow = limit ? myFriends.slice(0, limit) : myFriends.slice();
  const nodes = friendsToShow.map((name) => {
    const initials = name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
    const personObj = people.find(p => p.name === name);
    const avatar = personObj && personObj.image ? `<div class="person-avatar"><img src="${personObj.image}" alt="${name}"></div>` : `<div class="person-avatar">${initials}</div>`;
    return `<article class="person" data-person="${name}">${avatar}<div><h3>${name}</h3></div></article>`;
  }).join('');

  container.innerHTML = nodes;
  container.querySelectorAll('[data-person]').forEach((el) => el.addEventListener('click', () => openUserView(el.dataset.person)));

  // if we're in preview mode and there are more friends, show a "view all" control
  if (limit && myFriends.length > limit) {
    const existingFooter = container.parentNode.querySelector('.friend-list-footer');
    if (existingFooter) existingFooter.remove();
    const footer = document.createElement('div');
    footer.className = 'friend-list-footer';
    footer.style.marginTop = '8px';
    footer.innerHTML = `<button class="ghost" id="viewAllFriends">Sjá alla vini (${myFriends.length})</button>`;
    container.parentNode.appendChild(footer);
    const btn = footer.querySelector('#viewAllFriends');
    btn.addEventListener('click', () => {
      // render full list in place
      footer.remove();
      const fullNodes = myFriends.map((name) => {
        const initials = name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
        const personObj = people.find(p => p.name === name);
        const avatar = personObj && personObj.image ? `<div class="person-avatar"><img src="${personObj.image}" alt="${name}"></div>` : `<div class="person-avatar">${initials}</div>`;
        return `<article class="person" data-person="${name}">${avatar}<div><h3>${name}</h3></div></article>`;
      }).join('');
      container.innerHTML = fullNodes;
      container.querySelectorAll('[data-person]').forEach((el) => el.addEventListener('click', () => openUserView(el.dataset.person)));
      // add a "show less" button
      const collapse = document.createElement('div');
      collapse.className = 'friend-list-footer';
      collapse.style.marginTop = '8px';
      collapse.innerHTML = `<button class="ghost" id="collapseFriends">Sýna færri</button>`;
      container.parentNode.appendChild(collapse);
      collapse.querySelector('#collapseFriends').addEventListener('click', () => {
        collapse.remove();
        renderFriendList();
      });
    });
  } else {
    // remove any existing footer when showing full list or nothing to show
    const existingFooter = container.parentNode.querySelector('.friend-list-footer');
    if (existingFooter) existingFooter.remove();
  }
}

function openUserView(name) {
  const person = people.find(p => p.name === name) || { name, initials: name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase(), location: '', interests: [] };
  const isFriend = myFriends.includes(person.name);
  userViewContent.innerHTML = `
    <section class="profile-card" style="padding-top:14px;padding-bottom:12px;">
      <div class="profile-top" style="flex-direction:column;align-items:center;gap:10px;text-align:center;padding-bottom:6px">
        <div class="profile-photo" style="width:92px;height:92px;">
          ${person.image ? `<img src="${person.image}" alt="${person.name}">` : `<span style="font-size:1.4rem;font-weight:900">${person.initials}</span>`}
        </div>
        <div>
          <h2 id="userModalTitle">${person.name}</h2>
          <p style="margin:4px 0;color:var(--muted)">${person.location || ''}</p>
          <div style="margin-top:8px">${person.interests.map(i=>`<span class="chip">${displayInterest(i)}</span>`).join(' ')}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:6px">
        <button class="primary" id="userFriendBtn">${isFriend ? 'Fjarlægja vin' : 'Bæta við vini'}</button>
      </div>
    </section>
  `;

  // Only show the user's joined events if they are a friend
  if (isFriend) {
    userViewContent.insertAdjacentHTML('beforeend', `
      <section style="margin-top:14px;">
        <h3>Viðburðir sem ${person.name.split(' ')[0]} er skráð/ur á</h3>
        <div id="userJoinedEvents" class="event-list" style="margin-top:8px"></div>
      </section>
    `);

    const userJoinedContainer = document.getElementById('userJoinedEvents');
    if (userJoinedContainer) {
      const friendEvents = events.filter(e => Array.isArray(e.attendeesList) && e.attendeesList.includes(person.name));
      if (friendEvents.length === 0) {
        userJoinedContainer.innerHTML = '<div class="empty-state"><p>Engir skráðir viðburðir fyrir þennan notanda.</p></div>';
      } else {
        userJoinedContainer.innerHTML = friendEvents.map(ev => `
          <article class="event-card" data-friend-event="${ev.id}">
            <div class="event-body"><h3>${ev.title}</h3><div class="event-meta"><span>▣ ${ev.time}</span><span>⌖ ${ev.place}</span></div></div>
          </article>
        `).join('');
        userJoinedContainer.querySelectorAll('[data-friend-event]').forEach(el => {
          el.addEventListener('click', () => openEventView(el.dataset.friendEvent));
        });
      }
    }
  }
  document.getElementById('userFriendBtn').addEventListener('click', () => {
    if (isFriend) {
      removeFriend(person.name);
    } else {
      addFriend(person.name);
    }
    // re-open the user view to refresh content (joined events appear for friends)
    renderFriendList();
    renderPeople();
    openUserView(person.name);
  });
  showView('userView');
}

// back buttons for new views
if (backFromEventBtn) backFromEventBtn.addEventListener('click', () => showView('events'));
if (backFromUserBtn) backFromUserBtn.addEventListener('click', () => showView('discover'));

function addFriend(name) {
  if (!myFriends.includes(name)) myFriends.push(name);
  saveState();
  renderFriendList();
  showToast(`${name} bætt við sem vin.`);
}

function removeFriend(name) {
  myFriends = myFriends.filter(n => n !== name);
  saveState();
  renderFriendList();
  showToast(`${name} fjarlægður úr vinum.`);
}


if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    // clear current user and reset per-user state (friends should not carry over)
    localStorage.removeItem("bruinUser");
    myFriends = [];
    localStorage.setItem('bruinFriends', JSON.stringify(myFriends));
    renderFriendList();
    setLogoutVisibility(false);
    // reset subscribe button and premium badge
    if (subscribeButton) subscribeButton.textContent = 'Gerast Premium';
    if (premiumBadgeEl) premiumBadgeEl.style.display = 'none';
    showLoginModal();
    showToast("Þú hefur skráð þig út.");
  });
}

const existingUser = getUser();
if (existingUser) {
  // if the saved user included interests, adopt them
  if (Array.isArray(existingUser.interests) && existingUser.interests.length > 0) {
    myInterests = existingUser.interests.slice();
    saveState();
  } else {
    // if there are saved interests in localStorage from older flows, use them
    const stored = JSON.parse(localStorage.getItem("bruinMyInterests") || 'null');
    if (Array.isArray(stored) && stored.length > 0) myInterests = stored.slice();
  }
  applyUserToUI(existingUser);
  setLogoutVisibility(true);
  // make sure the saved user is added to any joined events
  addUserToJoinedEvents(existingUser.name);
  renderDiscoverChips();
  renderProfileInterests();
  renderAvailableInterests();
  syncInterestControls();
  renderFriendList();
} else {
  // show login modal on first visit
  renderLoginInterests();
  showLoginModal();
  setLogoutVisibility(false);
}
