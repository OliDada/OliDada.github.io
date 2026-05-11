const people = [
  {
    name: "Sigríður Árnadóttir",
    initials: "SÁ",
    age: "26-45",
    location: "Reykjavík",
    interests: ["Göngur", "Ljósmyndun", "Kaffi"],
    note: "3 sameiginleg áhugamál"
  },
  {
    name: "Jón Þórsson",
    initials: "JÞ",
    age: "46+",
    location: "Kópavogur",
    interests: ["Líkamsrækt", "Matargerð", "Tónlist"],
    note: "2 sameiginleg áhugamál"
  },
  {
    name: "Emma Jónsdóttir",
    initials: "EJ",
    age: "18-25",
    location: "Hafnarfjörður",
    interests: ["Spil", "Kaffi", "Ferðalög"],
    note: "4 sameiginleg áhugamál"
  },
  {
    name: "Kristján Helgason",
    initials: "KH",
    age: "46+",
    location: "Garðabær",
    interests: ["Golf", "Kaffi", "Göngur"],
    note: "2 sameiginleg áhugamál"
  },
  {
    name: "Diljá Rún",
    initials: "DR",
    age: "18-25",
    location: "Reykjavík",
    interests: ["Dans", "Tónlist", "Kvikmyndir"],
    note: "3 sameiginleg áhugamál"
  },
  {
    name: "Margrét Líf",
    initials: "ML",
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

let activeInterest = "all";
let eventMode = "all";
let joinedEvents = new Set(JSON.parse(localStorage.getItem("bruinJoinedEvents") || '["ellidaardalur-walk","hr-games"]'));
let myInterests = JSON.parse(localStorage.getItem("bruinMyInterests") || '["Göngur","Ljósmyndun","Kaffi","Matargerð","Tónlist"]');
myInterests.forEach((interest) => {
  if (!allInterests.includes(interest)) allInterests.push(interest);
});

const tabs = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");
const peopleList = document.querySelector("#peopleList");
const discoverChips = document.querySelector("#discoverChips");
const eventList = document.querySelector("#eventList");
const searchInput = document.querySelector("#searchInput");
const ageFilter = document.querySelector("#ageFilter");
const typeFilter = document.querySelector("#typeFilter");
const joinedCount = document.querySelector("#joinedCount");
const toast = document.querySelector("#toast");
const eventModes = document.querySelectorAll(".event-mode");
const eventModal = document.querySelector("#eventModal");
const eventForm = document.querySelector("#eventForm");
const eventInterestSelect = document.querySelector("#eventInterestSelect");
const myInterestsList = document.querySelector("#myInterests");
const availableInterestsList = document.querySelector("#availableInterests");
const interestForm = document.querySelector("#interestForm");
const detailModal = document.querySelector("#detailModal");
const eventDetail = document.querySelector("#eventDetail");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
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
document.querySelector("#closeDetailModal").addEventListener("click", closeDetailModal);
detailModal.addEventListener("click", (event) => {
  if (event.target === detailModal) closeDetailModal();
});

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
    <article class="person">
      <div class="person-avatar" aria-hidden="true">${person.initials}</div>
      <div>
        <h3>${person.name}</h3>
        <div class="meta">
          <span>⌖ ${person.location}</span>
          <span>♙ ${person.note}</span>
        </div>
        <div class="tags">${person.interests.map((interest) => `<span>${interest}</span>`).join("")}</div>
        <div class="person-actions">
          <button class="primary" type="button" data-connect="${person.name}">Tengjast ✨</button>
        </div>
      </div>
    </article>
  `).join("");

  peopleList.querySelectorAll("[data-connect]").forEach((button) => {
    button.addEventListener("click", () => showToast(`Beiðni send til ${button.dataset.connect}.`));
  });
}

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
      renderEventInterestOptions();
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
  renderEventInterestOptions();
  showToast(`${displayInterest(interest)} bætt við.`);
}

function renderEvents() {
  const age = ageFilter.value;
  const type = typeFilter.value;
  const filtered = events.filter((event) => {
    const ageMatch = age === "Allir" || event.age === "Allir" || event.age === age;
    const typeMatch = type === "Allt" || event.type === type;
    const modeMatch = eventMode === "all" || joinedEvents.has(event.id) || event.createdByMe;
    return ageMatch && typeMatch && modeMatch;
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
          <img src="${eventImage(event.image)}" alt="">
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
    card.addEventListener("click", () => openDetailModal(card.dataset.eventCard));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetailModal(card.dataset.eventCard);
      }
    });
  });
}

function openDetailModal(eventId) {
  const event = events.find((item) => item.id === eventId);
  if (!event) return;
  const joined = joinedEvents.has(event.id);
  eventDetail.innerHTML = `
    <div class="detail-image">
      <img src="${eventImage(event.image)}" alt="">
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
      <button class="primary detail-join ${joined ? "joined" : ""}" type="button" data-detail-join="${event.id}">
        ${joined ? "Afskrá mig" : "Skrá mig á viðburð"}
      </button>
    </div>
  `;
  detailModal.classList.add("show");
  detailModal.setAttribute("aria-hidden", "false");
  eventDetail.querySelector("[data-detail-join]").addEventListener("click", () => {
    toggleEventJoin(event);
    openDetailModal(event.id);
  });
}

function closeDetailModal() {
  detailModal.classList.remove("show");
  detailModal.setAttribute("aria-hidden", "true");
}

function toggleEventJoin(event) {
  if (joinedEvents.has(event.id)) {
    joinedEvents.delete(event.id);
    event.attendees = Math.max(1, event.attendees - 1);
    showToast(`Þú ert ekki lengur skráð/ur á ${event.title}.`);
  } else {
    joinedEvents.add(event.id);
    event.attendees += 1;
    showToast(`Þú ert skráð/ur á ${event.title}.`);
  }
  saveState();
  updateJoinedCount();
  renderEvents();
}

function eventImage(type) {
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
  joinedCount.textContent = joinedEvents.size;
}

function saveState() {
  localStorage.setItem("bruinEvents", JSON.stringify(events));
  localStorage.setItem("bruinJoinedEvents", JSON.stringify([...joinedEvents]));
  localStorage.setItem("bruinMyInterests", JSON.stringify(myInterests));
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
renderEventInterestOptions();
updateJoinedCount();
renderEvents();
