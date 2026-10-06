const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let toastTimeout;

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 4500);
}

function hydrateVideo(video) {
  if (video.dataset.src && !video.getAttribute('src')) {
    video.src = video.dataset.src;
    video.load();
  }
}

// Keep all videos at 2x after metadata loads.
$$('video').forEach(video => {
  video.defaultPlaybackRate = 2;
  video.playbackRate = 2;
  video.addEventListener('loadedmetadata', () => { video.playbackRate = 2; });
});

const lazyMedia = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => {
  if (isIntersecting) {
    hydrateVideo(target);
    lazyMedia.unobserve(target);
  }
}), { rootMargin: '180px' });
$$('video[data-src]').forEach(video => lazyMedia.observe(video));

const playbackObserver = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => {
  if (!isIntersecting) target.pause();
  else if (target.hasAttribute('data-interaction-preview') && !document.hidden) {
    hydrateVideo(target);
    target.play().catch(() => {});
  }
}), { threshold: .05 });
$$('video').forEach(video => playbackObserver.observe(video));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    $$('video').forEach(video => video.pause());
  }
});

const dialog = $('#figure-dialog');
function resetFigureZoom() {
  $('.figure-viewport').classList.remove('is-zoomed');
  $('#figure-zoom').textContent = 'Zoom in +';
  $('#figure-zoom').setAttribute('aria-pressed', 'false');
}
$('#figure-zoom').addEventListener('click', () => {
  const zoomed = $('.figure-viewport').classList.toggle('is-zoomed');
  $('#figure-zoom').textContent = zoomed ? 'Fit to screen −' : 'Zoom in +';
  $('#figure-zoom').setAttribute('aria-pressed', String(zoomed));
});
$$('[data-figure]').forEach(button => button.addEventListener('click', () => {
  resetFigureZoom();
  $('#dialog-image').src = button.dataset.figure;
  $('#dialog-image').alt = $('img', button).alt;
  $('#figure-caption').textContent = button.dataset.caption;
  dialog.showModal();
}));
$('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});
dialog.addEventListener('close', () => { $('#dialog-image').removeAttribute('src'); resetFigureZoom(); });

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) $$('nav a').forEach(link => {
      const active = link.hash === '#' + entry.target.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  });
}, { rootMargin: '-15% 0px -60% 0px' });
$$('#overview,#method,#demos,#results').forEach(section => sectionObserver.observe(section));

function renderResults(results) {
  function renderMetric(target, force, families = results.families, append = false) {
    const markup = families.map(family => {
      const methods = results.rows.filter(row => family.methods ? family.methods.includes(row[1]) : row[0] === family.name).map(row => {
        const values = force ? results.forceErrors[row[1]].map(item => item.mean) : row.slice(2);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        return {name: row[1], value: mean, label: force ? mean.toFixed(2) : mean + '%', ours: row[1] === (family.ours || family.name + '-ILA')};
      });
      methods.sort((a, b) => Number(a.ours) - Number(b.ours) || (force ? b.value - a.value : a.value - b.value));
      const description = methods.map(method => method.name + ': ' + method.label).join(', ');
      return '<article class="chart-group" style="--bar-count:' + methods.length + '" aria-label="' + family.label.replace(/<[^>]*>/g, '') + (force ? ' mean execution force-proxy error: ' : ' mean success rate: ') + description + '">' +
        '<div class="chart-group-title"><h3>' + family.label + '</h3></div>' +
        '<div class="bars" aria-hidden="true">' + methods.map(method =>
          '<div class="bar' + (method.ours ? ' ours' : '') + '" style="--value:' + (force ? method.value / 6 * 100 : method.value) + '"><span>' + method.label + '</span></div>'
        ).join('') + '</div>' +
        '<div class="bar-labels" aria-hidden="true">' + methods.map(method => '<span>' + method.name + '</span>').join('') + '</div></article>';
    }).join('');
    if (append) $(target).insertAdjacentHTML('beforeend', markup);
    else $(target).innerHTML = markup;
  }
  renderMetric('#results-chart', false);
  renderMetric('#force-results-chart', true);
  const tasks = ['Peeling', 'Flipping', 'Cutting', 'Wiping'];
  const improvementMethods = ['FM-ILA', 'FM-ILA-RL'];
  $('#improvement-results-chart').innerHTML = [false, true].map(force => {
    const title = force ? 'Execution force-proxy error (F<sub>ext</sub> L1) &darr;' : 'Success rate (%) &uarr;';
    const groups = tasks.map((task, i) => {
      const values = improvementMethods.map(name => force ? results.forceErrors[name][i].mean : results.rows.find(row => row[1] === name)[i + 2]);
      const labels = values.map(value => force ? value.toFixed(2) : value + '%');
      return '<div class="task-bar-group" aria-label="' + task + ': FM-ILA ' + labels[0] + ', FM-ILA-RL ' + labels[1] + '">' +
        '<div class="task-bar-pair" aria-hidden="true">' + values.map((value, j) =>
          '<div class="bar' + (j === 1 ? ' ours' : '') + '" style="--value:' + (force ? value * 10 : value) + '"><span>' + labels[j] + '</span></div>'
        ).join('') + '</div><div class="task-bar-label" aria-hidden="true">' + task + '</div></div>';
    }).join('');
    return '<article class="chart-group"><div class="chart-group-title"><h4>' + title + '</h4></div><div class="task-bars">' + groups + '</div></article>';
  }).join('');
}

async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Unable to load ' + path);
  return response.json();
}
getJSON('assets/data/results.json').then(value => { renderResults(value); }).catch(error => {
  console.error(error);
  $('#results-chart').textContent = 'Results could not be loaded. Please reload the page.';
});
