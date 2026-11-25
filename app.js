(() => {
  'use strict';
  const articles = window.HERALDRY_ARTICLES;
  const find = selector => document.querySelector(selector);
  const storageKey = 'gym227-heraldry-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { saved = {}; }
  const visited = new Set(Array.isArray(saved.visited) ? saved.visited : []);
  const notes = saved.notes && typeof saved.notes === 'object' ? saved.notes : {};
  const solved = new Set(Array.isArray(saved.solved) ? saved.solved : []);
  let current = 0;
  let zoom = 1;
  let pan = { x:0, y:0 };
  let returnFocus = null;
  let dragging = null;
  let saveTimer;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({visited:[...visited], notes, solved:[...solved]}));
      return true;
    } catch { return false; }
  }

  function link(title, url, className) {
    const node = element('a', className, title);
    node.href = url;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  }

  function updateProgress() {
    const count = articles.filter(article => visited.has(article.id)).length;
    find('#progress-count').textContent = count + ' из 9';
    find('#progress-fill').style.width = count / articles.length * 100 + '%';
    document.querySelectorAll('[data-station]').forEach(button => {
      const article = articles[Number(button.dataset.station)];
      button.classList.toggle('read', visited.has(article.id));
      button.classList.toggle('current', Number(button.dataset.station) === current && count > 0);
    });
    if (count === articles.length) {
      find('#journey-status').textContent = 'Все рубрики открыты! Загляните во «Всю газету» и прочитайте заметки групп.';
    }
  }

  articles.forEach((article, index) => {
    const button = element('button', 'station');
    button.style.left = article.x + '%';
    button.style.top = article.y + '%';
    button.dataset.station = index;
    button.setAttribute('aria-label', article.place + '. ' + article.question);
    const number = element('span', 'number');
    number.append(element('span', '', index + 1));
    button.append(number, element('span', '', article.short));
    button.addEventListener('click', () => openArticle(index));
    find('#map-stations').append(button);

    const shortcut = element('button', '', index + 1);
    shortcut.dataset.station = index;
    shortcut.setAttribute('aria-label', article.question);
    shortcut.addEventListener('click', () => openArticle(index));
    find('#station-index').append(shortcut);
  });

  function showDialog(dialog) {
    returnFocus = document.activeElement;
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  function makeVisual(article) {
    const visual = element('aside', 'article-visual');
    if (article.art === 'calendar') {
      const calendar = element('div', 'calendar-leaf');
      calendar.append(element('div', 'big-date', '30'), element('div', 'date-month', 'ноября'));
      visual.append(calendar, element('p', '', 'День Государственного герба Российской Федерации'));
    } else if (article.art === 'years') {
      const years = element('div', 'year-pair');
      years.append(element('div', '', '1993'), element('small', '', 'Современное изображение'), element('div', '', '2000'), element('small', '', 'Закон о гербе'));
      visual.append(years);
    } else if (article.art === 'seal') {
      const image = element('img', 'seal-photo');
      image.src = 'assets/seal-1497.jpg';
      image.alt = 'Прорисовка двух сторон государственной печати Ивана III';
      const flip = element('button', 'seal-flip', 'Посмотреть подлинник');
      let reverse = false;
      flip.addEventListener('click', () => {
        reverse = !reverse;
        image.src = reverse ? 'assets/seal-1497-back.jpg' : 'assets/seal-1497.jpg';
        image.alt = reverse ? 'Подлинная грамота 1497 года и две стороны восковой печати' : 'Прорисовка двух сторон государственной печати Ивана III';
        flip.textContent = reverse ? 'Вернуться к прорисовке' : 'Посмотреть подлинник';
        image.animate([{opacity:0.2,transform:'rotateY(60deg)'},{opacity:1,transform:'rotateY(0)'}],{duration:450});
      });
      visual.append(image, flip, element('p', '', 'Печать 1497 года. Изображения — «Геральдикум», по материалам РГАДА.'));
    } else if (article.art === 'book') {
      visual.append(element('div', 'archive-book', '📖'), element('div', 'stamp', 'Геральдика'), element('p', '', 'Наука, которая помогает читать язык гербов'));
    } else if (article.art === 'chain') {
      visual.append(element('div', 'chain-art', '⛓'), element('div', 'stamp', 'Пётр I'), element('p', '', 'Андреевская цепь окружала щит со всадником на историческом гербе.'));
    } else {
      const image = element('img');
      image.src = 'assets/coat-russia.svg';
      image.alt = 'Государственный герб Российской Федерации';
      visual.append(image);
      if (article.art === 'symbols') {
        const parts = element('div', 'symbol-parts');
        const detail = element('p', 'symbol-detail', 'Нажмите на название детали герба.');
        [['Короны','Над двумя головами орла расположены две малые короны и одна большая над ними.'],['Скипетр','Скипетр — жезл в правой лапе орла. На рисунке он находится слева от зрителя.'],['Держава','Держава — шар с крестом в левой лапе орла. Это один из исторических знаков государственной власти.']].forEach(([name,text]) => {
          const button = element('button', '', name);
          button.addEventListener('click', () => { detail.textContent = text; });
          parts.append(button);
        });
        visual.append(parts, detail);
      } else {
        visual.append(element('p', '', 'Золотой двуглавый орёл на красном щите'));
      }
    }
    return visual;
  }

  function openArticle(index) {
    clearTimeout(saveTimer);
    current = (index + articles.length) % articles.length;
    const article = articles[current];
    visited.add(article.id);
    save();
    updateProgress();
    find('#traveler').style.left = article.x + '%';
    find('#traveler').style.top = (article.y - 9) + '%';
    find('#journey-status').textContent = article.place;
    const wrapper = element('div', 'article-layout');
    const main = element('section', 'article-main');
    const heading = element('h2', '', article.question);
    heading.id = 'article-heading';
    main.append(element('p', 'article-section-name', article.place + ' · Рубрика ' + (current + 1) + ' из 9'), heading);
    const tabs = element('div', 'article-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Разделы рубрики');
    const body = element('div', 'article-panel');
    body.id = 'article-panel';
    body.setAttribute('role', 'tabpanel');
    const tabButtons = [];
    ['Читать', 'Проверить себя', 'Наша заметка'].forEach((label, tabIndex) => {
      const button = element('button', '', label);
      button.setAttribute('role', 'tab');
      button.id = 'article-tab-' + tabIndex;
      button.setAttribute('aria-controls', 'article-panel');
      button.addEventListener('click', () => selectTab(tabIndex));
      tabs.append(button);
      tabButtons.push(button);
    });

    function selectTab(tabIndex) {
      tabButtons.forEach((button, i) => {
        button.setAttribute('aria-selected', String(i === tabIndex));
        button.tabIndex = i === tabIndex ? 0 : -1;
      });
      body.setAttribute('aria-labelledby', tabButtons[tabIndex].id);
      body.replaceChildren();
      if (tabIndex === 0) {
        body.append(element('p', 'answer', article.answer));
        const text = element('div', 'article-body');
        article.paragraphs.forEach(paragraph => text.append(element('p', '', paragraph)));
        body.append(text, element('div', 'fact-note', article.note));
        body.append(link(article.source, article.url, 'source-link'));
      } else if (tabIndex === 1) {
        body.append(element('p', 'quiz-question', article.quiz.question), element('p', 'choice-instruction', 'Обсудите с группой и выберите один ответ.'));
        const choices = element('div', 'choices');
        const feedback = element('div', 'quiz-feedback');
        feedback.setAttribute('role', 'status');
        article.quiz.choices.forEach((choice, choiceIndex) => {
          const button = element('button', '', choice);
          button.addEventListener('click', () => {
            const right = choiceIndex === article.quiz.correct;
            button.classList.add(right ? 'correct' : 'incorrect');
            button.setAttribute('aria-pressed', 'true');
            if (right) {
              solved.add(article.id);
              save();
              choices.querySelectorAll('button').forEach(item => { item.disabled = true; });
              feedback.textContent = 'Верно! ' + article.quiz.feedback;
            } else {
              button.disabled = true;
              feedback.textContent = 'Подумайте ещё. ' + article.quiz.feedback;
            }
          });
          choices.append(button);
        });
        body.append(choices, feedback);
        if (solved.has(article.id)) body.append(element('p', 'stat-line', 'Вы уже верно ответили на этот вопрос. Можно повторить.'));
      } else {
        const label = element('label', 'note-label', 'Заметка нашей группы');
        label.htmlFor = 'group-note';
        body.append(label, element('p', 'article-body', article.task));
        const note = element('textarea');
        note.id = 'group-note';
        note.maxLength = 1500;
        note.placeholder = 'Напишите короткий текст для своей рубрики…';
        note.value = notes[article.id] || '';
        const status = element('p', 'note-status', 'Заметка сохраняется в этом браузере и добавляется во «Всю газету».');
        status.setAttribute('role', 'status');
        note.addEventListener('input', () => {
          notes[article.id] = note.value;
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            status.textContent = save() ? 'Сохранено в этом браузере.' : 'Запомнено до закрытия страницы. Для сохранения воспользуйтесь печатью газеты.';
          }, 300);
        });
        body.append(note, status);
      }
    }

    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const active = tabButtons.indexOf(document.activeElement);
      const next = (active + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
      selectTab(next);
      tabButtons[next].focus();
    });

    main.append(tabs, body);
    const navigation = element('div', 'article-nav');
    const back = element('button', '', 'На карту');
    back.addEventListener('click', () => find('#article-dialog').close());
    const next = element('button', 'complete-button', current === articles.length - 1 ? 'Собрать газету' : 'Следующая рубрика');
    next.addEventListener('click', () => {
      if (current === articles.length - 1) {
        find('#article-dialog').close();
        openNewspaper();
      } else {
        openArticle(current + 1);
        find('#article-dialog .close-dialog').focus();
      }
    });
    navigation.append(back, next);
    main.append(navigation);
    wrapper.append(makeVisual(article), main);
    find('#article-content').replaceChildren(wrapper);
    selectTab(0);
    if (!find('#article-dialog').open) showDialog(find('#article-dialog'));
    else find('#article-dialog').scrollTop = 0;
  }

  function openNewspaper() {
    clearTimeout(saveTimer);
    save();
    const container = find('#paper-articles');
    container.replaceChildren();
    articles.forEach(article => {
      const item = element('article');
      item.append(element('h3', '', article.question), element('p', 'paper-answer', article.answer));
      article.paragraphs.forEach(paragraph => item.append(element('p', '', paragraph)));
      if (notes[article.id] && notes[article.id].trim()) item.append(element('p', 'paper-note', 'Наша группа пишет: ' + notes[article.id]));
      item.append(link(article.source, article.url, 'source-link'));
      container.append(item);
    });
    showDialog(find('#paper-dialog'));
  }

  const uniqueSources = new Map();
  articles.forEach(article => { if (!uniqueSources.has(article.url)) uniqueSources.set(article.url, article.source); });
  uniqueSources.forEach((title,url) => find('#sources-list').append(link(title,url)));
  find('#sources-list').append(link('Государственный герб — изображение и сведения о файле','https://commons.wikimedia.org/wiki/File:Coat_of_Arms_of_the_Russian_Federation.svg'));
  find('#sources-list').append(link('СПбГУ — исследование истории герба петровского времени','https://pureportal.spbu.ru/files/94621065/_2.pdf'));

  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      clearTimeout(saveTimer);
      save();
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    });
  });

  find('.school').addEventListener('click', event => { event.preventDefault(); resetZoom(); });
  find('#start-button').addEventListener('click', () => openArticle(articles.findIndex(article => !visited.has(article.id)) < 0 ? 0 : articles.findIndex(article => !visited.has(article.id))));
  find('#newspaper-button').addEventListener('click', openNewspaper);
  find('#sources-button').addEventListener('click', () => showDialog(find('#sources-dialog')));
  find('#print-button').addEventListener('click', () => window.print());
  find('#reset-button').addEventListener('click', () => {
    if (!window.confirm('Начать заново? Отметки и заметки групп в этом браузере будут очищены.')) return;
    visited.clear(); solved.clear();
    Object.keys(notes).forEach(key => delete notes[key]);
    current = 0;
    save(); updateProgress(); resetZoom();
    find('#sources-dialog').close();
    find('#journey-status').textContent = 'Выберите первую остановку или любую интересную рубрику';
  });
  find('#fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      find('#journey-status').textContent = 'Полный экран можно включить клавишей F11 в браузере.';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    find('#fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Выйти из полного экрана' : 'На весь экран');
  });

  function updateZoom() {
    const mobile = window.innerWidth <= 760;
    find('#map-stage').style.transform = (mobile ? '' : 'translate(-50%,-50%) ') + 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')';
    find('#zoom-reset').textContent = Math.round(zoom * 100) + '%';
    find('#zoom-out').disabled = zoom <= 0.8;
    find('#zoom-in').disabled = zoom >= 1.8;
  }
  function resetZoom() {
    zoom = 1;
    pan = {x:0,y:0};
    find('#map-viewport').scrollLeft = 0;
    updateZoom();
  }
  find('#zoom-in').addEventListener('click', () => { zoom = Math.min(1.8, Number((zoom + 0.2).toFixed(1))); updateZoom(); });
  find('#zoom-out').addEventListener('click', () => { zoom = Math.max(0.8, Number((zoom - 0.2).toFixed(1))); updateZoom(); });
  find('#zoom-reset').addEventListener('click', resetZoom);
  const viewport = find('#map-viewport');
  viewport.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || window.innerWidth <= 760 || zoom <= 1) return;
    dragging = {x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('dragging');
  });
  viewport.addEventListener('pointermove', event => {
    if (!dragging) return;
    const limitX = viewport.clientWidth * (zoom - 1) / 2;
    const limitY = viewport.clientHeight * (zoom - 1) / 2;
    pan.x = Math.max(-limitX, Math.min(limitX, dragging.panX + event.clientX - dragging.x));
    pan.y = Math.max(-limitY, Math.min(limitY, dragging.panY + event.clientY - dragging.y));
    updateZoom();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => viewport.addEventListener(type, () => {
    dragging = null; viewport.classList.remove('dragging');
  }));
  window.addEventListener('resize', resetZoom);
  updateProgress();
  resetZoom();
})();
