// Elite Digital Solutions - Frontend Logic

const API = '/api';

// ---------- Helpers ----------
async function fetchJSON(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    return await res.json();
  } catch (e) {
    console.error('Fetch error:', url, e);
    return { success: false, error: 'Network error' };
  }
}

function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- Mobile Menu ----------
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
  document.getElementById('mobile-menu')?.classList.toggle('hidden');
});

// Close mobile menu on link click
document.querySelectorAll('#mobile-menu a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });
});

// ---------- Services ----------
async function loadServices() {
  const grid = document.getElementById('services-grid');
  const data = await fetchJSON(`${API}/services`);
  if (!data.success || !data.data?.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">No services available yet.</div>';
    return;
  }

  const icons = {
    facebook: '📘', pages: '📄', youtube: '▶️', copyright: '©️',
    megaphone: '📢', palette: '🎨', video: '🎬', globe: '🌐', shield: '🛡️'
  };

  grid.innerHTML = data.data.map(s => `
    <div class="service-card">
      <div class="service-icon text-2xl">${icons[s.icon] || '✦'}</div>
      <div class="text-xs text-gold-500/80 uppercase tracking-wider mb-2">${escapeHtml(s.category)}</div>
      <h3 class="font-semibold text-lg mb-2 text-white">${escapeHtml(s.title_en)}</h3>
      <p class="text-gray-400 text-sm leading-relaxed mb-4">${escapeHtml(s.short_desc_en || s.description_en?.slice(0, 120) + '...')}</p>
      <div class="flex items-center justify-between mt-auto pt-3 border-t border-gold-500/10">
        <span class="text-gold-400 text-sm font-medium">${escapeHtml(s.price_label || 'Custom Quote')}</span>
        <a href="#order" class="text-xs text-gray-400 hover:text-gold-400 transition">Order →</a>
      </div>
    </div>
  `).join('');

  // Populate order form select
  const select = document.getElementById('order-service-select');
  if (select) {
    select.innerHTML = '<option value="">Select a service...</option>' +
      data.data.map(s => `<option value="${escapeHtml(s.title_en)}">${escapeHtml(s.title_en)}</option>`).join('');
  }
}

// ---------- Projects / Portfolio ----------
async function loadProjects() {
  const grid = document.getElementById('projects-grid');
  const data = await fetchJSON(`${API}/projects`);
  if (!data.success || !data.data?.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">Sample projects coming soon.</div>';
    return;
  }

  grid.innerHTML = data.data.map(p => `
    <div class="project-card group">
      <div class="relative aspect-video rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-charcoal-800 to-black border border-gold-500/10 flex items-center justify-center">
        ${p.image_url 
          ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title_en)}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="text-4xl text-gold-500/30">✦</div>`
        }
        <div class="absolute top-3 left-3">
          <span class="sample-badge">Sample / Concept Demo</span>
        </div>
      </div>
      <div class="text-xs text-gold-500/80 uppercase tracking-wider mb-1">${escapeHtml(p.category)}</div>
      <h3 class="font-semibold text-base mb-2 leading-snug">${escapeHtml(p.title_en)}</h3>
      <p class="text-gray-400 text-sm line-clamp-2 mb-4">${escapeHtml(p.description_en?.slice(0, 110))}...</p>
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500">${escapeHtml(p.client_name || 'Concept')}</span>
        ${p.demo_url 
          ? `<a href="${escapeHtml(p.demo_url)}" class="text-xs text-gold-400 hover:underline">View Demo →</a>`
          : `<span class="text-xs text-gray-600">Preview Only</span>`
        }
      </div>
    </div>
  `).join('');
}

// ---------- Reviews ----------
async function loadReviews() {
  const data = await fetchJSON(`${API}/reviews`);
  const realContainer = document.getElementById('real-reviews-container');
  const emptyState = document.getElementById('reviews-empty-state');
  const subtitle = document.getElementById('reviews-subtitle');
  const track = document.getElementById('reviews-track');

  if (data.success && data.data?.length > 0) {
    // Show real reviews
    emptyState?.classList.add('hidden');
    realContainer?.classList.remove('hidden');
    if (subtitle) subtitle.textContent = 'Feedback from our valued clients';

    track.innerHTML = data.data.map(r => `
      <div class="review-card">
        <p class="text-gray-300 italic mb-4 leading-relaxed">"${escapeHtml(r.review_text_en)}"</p>
        <div class="flex text-gold-500 text-sm mb-3">${stars(r.rating)}</div>
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium text-white">${escapeHtml(r.customer_name)}</div>
            <div class="text-xs text-gray-500">${escapeHtml(r.service_taken || 'Client')}</div>
          </div>
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-gold-500/30 to-gold-700/30 flex items-center justify-center text-gold-400 font-bold">
            ${escapeHtml(r.customer_name?.charAt(0)?.toUpperCase() || 'C')}
          </div>
        </div>
      </div>
    `).join('');

    // Carousel controls
    const prev = document.getElementById('rev-prev');
    const next = document.getElementById('rev-next');
    prev?.addEventListener('click', () => track.scrollBy({ left: -360, behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: 360, behavior: 'smooth' }));
  } else {
    // Keep empty state visible
    realContainer?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
  }
}

// ---------- Packages ----------
async function loadPackages() {
  const grid = document.getElementById('packages-grid');
  const data = await fetchJSON(`${API}/packages`);
  if (!data.success || !data.data?.length) {
    grid.innerHTML = '<div class="col-span-full text-center text-gray-500">Packages coming soon.</div>';
    return;
  }

  grid.innerHTML = data.data.map(p => {
    let features = [];
    try { features = JSON.parse(p.features_en || '[]'); } catch {}
    const isPopular = p.is_popular === 1;

    return `
      <div class="package-card ${isPopular ? 'popular' : ''}">
        ${isPopular ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gold-500 text-black text-xs font-bold rounded-full">Most Popular</div>' : ''}
        <h3 class="font-display text-xl font-bold mb-1">${escapeHtml(p.name_en)}</h3>
        <p class="text-gray-400 text-sm mb-6">${escapeHtml(p.description_en || '')}</p>
        <div class="mb-6">
          <span class="text-3xl font-bold text-gold-400">৳${Number(p.price).toLocaleString()}</span>
          ${p.original_price ? `<span class="text-gray-500 line-through ml-2 text-sm">৳${Number(p.original_price).toLocaleString()}</span>` : ''}
        </div>
        <ul class="space-y-2 mb-8 text-sm text-gray-300">
          ${features.map(f => `<li class="flex items-start gap-2"><span class="text-gold-500 mt-0.5">✓</span>${escapeHtml(f)}</li>`).join('')}
        </ul>
        <a href="#order" class="btn-outline w-full text-center">Get Started</a>
      </div>
    `;
  }).join('');
}

// ---------- FAQs ----------
async function loadFAQs() {
  const list = document.getElementById('faq-list');
  const data = await fetchJSON(`${API}/faqs`);
  if (!data.success || !data.data?.length) {
    list.innerHTML = '<div class="text-center text-gray-500">No FAQs yet.</div>';
    return;
  }

  list.innerHTML = data.data.map((f, i) => `
    <div class="faq-item" data-index="${i}">
      <button class="faq-question" onclick="toggleFaq(${i})">
        <span>${escapeHtml(f.question_en)}</span>
        <svg class="faq-icon w-5 h-5 text-gold-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div class="faq-answer">${escapeHtml(f.answer_en)}</div>
    </div>
  `).join('');
}

window.toggleFaq = function(index) {
  const item = document.querySelector(`.faq-item[data-index="${index}"]`);
  const wasOpen = item?.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
  if (!wasOpen) item?.classList.add('open');
};

// ---------- Forms ----------
document.getElementById('order-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('order-form-msg');
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const body = Object.fromEntries(new FormData(form));
  const res = await fetchJSON(`${API}/orders`, { method: 'POST', body: JSON.stringify(body) });

  msg.classList.remove('hidden');
  if (res.success) {
    msg.className = 'text-center text-sm text-green-400';
    msg.textContent = `Order submitted! Reference: ${res.data.reference_no}. We will contact you soon.`;
    form.reset();
  } else {
    msg.className = 'text-center text-sm text-red-400';
    msg.textContent = res.error || 'Something went wrong. Please try again.';
  }
  btn.disabled = false;
  btn.textContent = 'Submit Order';
});

document.getElementById('contact-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('contact-form-msg');
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const body = Object.fromEntries(new FormData(form));
  const res = await fetchJSON(`${API}/contact`, { method: 'POST', body: JSON.stringify(body) });

  msg.classList.remove('hidden');
  if (res.success) {
    msg.className = 'text-center text-sm text-green-400';
    msg.textContent = res.data.message || 'Message sent successfully!';
    form.reset();
  } else {
    msg.className = 'text-center text-sm text-red-400';
    msg.textContent = res.error || 'Failed to send. Please try again.';
  }
  btn.disabled = false;
});

document.getElementById('review-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('review-form-msg');
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const body = Object.fromEntries(new FormData(form));
  const res = await fetchJSON(`${API}/reviews`, { method: 'POST', body: JSON.stringify(body) });

  msg.classList.remove('hidden');
  if (res.success) {
    msg.className = 'text-center text-sm text-green-400';
    msg.textContent = res.data.message || 'Thank you! Your review is pending approval.';
    form.reset();
  } else {
    msg.className = 'text-center text-sm text-red-400';
    msg.textContent = res.error || 'Failed to submit.';
  }
  btn.disabled = false;
});

// ---------- Language Switcher (basic) ----------
document.getElementById('lang-bn')?.addEventListener('click', () => {
  alert('Bengali language support is prepared in the database. Full UI translation can be expanded. Currently showing English.');
});

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  loadProjects();
  loadReviews();
  loadPackages();
  loadFAQs();
});