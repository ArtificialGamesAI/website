/* feed.js - renders posts into the living feed. One renderer, used by the site and the composer preview.
   A post: { id, date, status, section, byline, made, title, body, images:[{file, caption}], score, link, lane }
   Sections: note, pearl, build, essay, column. Kicker names are DERIVED here, never stored. */
(function (global) {
  'use strict';

  var SECTIONS = {
    note:   { kick: 'Note you. Yours.', type: 'tiny human thoughts' },
    pearl:  { kick: 'Sequiturs, non',   type: '#shitLLMssay' },
    build:  { kick: 'Not ready. Yet.',  type: 'from the workshop' },
    essay:  { kick: 'Sorrell, Mark',    type: 'also available on Substack' },
    column: { kick: null,               type: 'a made person, in their own words' }
  };

  /* column kickers are per author */
  var COLUMNISTS = {
    'lucinda':          'Made, up',
    'the duchess':      'Off, fuck',
    'duchess':          'Off, fuck',
    'apex_blood_lord':  'Count, words',
    'abl':              'Count, words',
    'dramatist':        'Dramatis, personae'
  };

  var MARK = 'Mark Sorrell';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function kickFor(p) {
    var s = SECTIONS[p.section] || SECTIONS.note;
    if (p.section === 'column') {
      var k = COLUMNISTS[String(p.byline || '').trim().toLowerCase()];
      return k || (p.byline || 'Column');
    }
    return s.kick;
  }

  function typeFor(p) {
    return (SECTIONS[p.section] || SECTIONS.note).type;
  }

  function ago(iso, now) {
    now = now || new Date();
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var s = Math.max(0, (now - d) / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    var days = Math.floor(h / 24); if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    var w = Math.floor(days / 7); if (w < 5) return w + (w === 1 ? ' week ago' : ' weeks ago');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  /* body -> html. Paragraphs split on blank lines. A line that is exactly [imgN] becomes that image with its caption.
     Nothing else is interpreted. Plain text in, honest paragraphs out. */
  function bodyHtml(p, imgBase) {
    var imgs = p.images || [];
    var out = '';
    var paras = String(p.body || '').replace(/\r\n/g, '\n').split(/\n\s*\n/);
    for (var i = 0; i < paras.length; i++) {
      var para = paras[i].trim();
      if (!para) continue;
      var m = para.match(/^\[img(\d+)\]$/i);
      if (m) {
        var im = imgs[parseInt(m[1], 10) - 1];
        if (im) out += figure(im, imgBase);
        continue;
      }
      out += '<p>' + esc(para).replace(/\n/g, '<br>') + '</p>';
    }
    /* images never referenced by a token trail the text */
    var used = {};
    var re = /\[img(\d+)\]/gi, mm;
    while ((mm = re.exec(p.body || ''))) used[parseInt(mm[1], 10) - 1] = true;
    for (var j = 0; j < imgs.length; j++) if (!used[j]) out += figure(imgs[j], imgBase);
    return out;
  }

  function figure(im, imgBase) {
    var src = (imgBase || '') + encodeURIComponent(im.file);
    return '<figure class="shot"><img src="' + src + '" alt="' + esc(im.caption) + '" loading="lazy">' +
      (im.caption ? '<figcaption class="cap">' + esc(im.caption) + '</figcaption>' : '') + '</figure>';
  }

  function scoreHtml(p) {
    if (p.score == null || p.score === '') return '';
    var n = Math.max(0, Math.min(100, Number(p.score)));
    if (isNaN(n)) return '';
    var cls = n >= 50 ? 'ai' : 'hum';
    return '<span class="pg"><span class="pbar ' + cls + '"><i style="width:' + n + '%"></i></span><span class="lab">Pangram</span> <b>' + n + '%</b> AI</span>';
  }

  function bylineHtml(p) {
    var isMark = !p.made && (String(p.byline || MARK).trim() === MARK || !p.byline);
    var name = p.byline || MARK;
    var initial = esc(name.trim().charAt(0).toUpperCase() || 'M');
    var lane = p.lane ? esc(p.lane) : (p.made ? (p.section === 'pearl' ? 'from the game' : 'entirely LLM-written') : '');
    return '<span class="by"><span class="av ' + (isMark ? 'mark' : 'char') + '">' + initial + '</span>' +
      '<span class="who' + (isMark ? '' : ' char') + '">' + esc(name) + '</span>' +
      (lane ? '<span class="lane">· ' + lane + '</span>' : '') + '</span>';
  }

  function render(p, opts) {
    opts = opts || {};
    var imgBase = opts.imgBase || 'img/';
    var now = opts.now || new Date();
    var h = '<article class="post" data-id="' + esc(p.id) + '">';
    h += '<div class="kick">' + esc(kickFor(p)) + ' <span class="type">' + esc(typeFor(p)) + '</span></div>';

    if (p.section === 'pearl') {
      var lines = String(p.body || '').replace(/\r\n/g, '\n').split(/\n\s*\n/).filter(function (x) { return x.trim(); });
      h += '<div class="pearl">' + lines.map(function (l) { return '<p class="line">“' + esc(l.trim()).replace(/\n/g, '<br>') + '”</p>'; }).join('') + '</div>';
    } else if (p.section === 'column') {
      if (p.title) h += '<h2 class="ptitle">' + esc(p.title) + '</h2>';
      h += '<p class="dek">This week’s column is written by <b>' + esc(p.byline || 'a character') + '</b>, who isn’t real.</p>';
      h += '<div class="serif-body">' + bodyHtml(p, imgBase) + '</div>';
    } else if (p.section === 'essay') {
      if (p.title) h += '<h2 class="ptitle">' + (p.link ? '<a href="' + esc(p.link) + '">' + esc(p.title) + '</a>' : esc(p.title)) + '</h2>';
      h += '<div class="excerpt">' + bodyHtml(p, imgBase) + (p.link ? '<p><a class="more" href="' + esc(p.link) + '">Read →</a></p>' : '') + '</div>';
    } else if (p.section === 'build') {
      if (p.title) h += '<h2 class="ptitle">' + esc(p.title) + '</h2>';
      h += '<div class="excerpt">' + bodyHtml(p, imgBase) + '</div>';
      if (p.link) h += '<p class="excerpt"><a class="more" href="' + esc(p.link) + '">More →</a></p>';
    } else { /* note */
      if (p.title) h += '<h2 class="ptitle">' + esc(p.title) + '</h2>';
      h += '<div class="note-body">' + bodyHtml(p, imgBase) + '</div>';
      if (p.link) h += '<p class="excerpt"><a class="more" href="' + esc(p.link) + '">→ ' + esc(p.link.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a></p>';
    }

    h += '<div class="meta">' + bylineHtml(p) +
      '<span class="dotsep">·</span><span title="' + esc(p.date) + '">' + esc(ago(p.date, now)) + '</span>' +
      scoreHtml(p) + '</div>';
    h += '</article>';
    return h;
  }

  function pulse(posts, now) {
    now = now || new Date();
    if (!posts.length) return 'Lights on. Nothing thrown out the door yet.';
    var latest = posts[0];
    var month = now.getMonth(), year = now.getFullYear();
    var n = posts.filter(function (p) { var d = new Date(p.date); return d.getMonth() === month && d.getFullYear() === year; }).length;
    var monthWord = n === 1 ? 'thing' : 'things';
    return 'Working now · <b>last posted ' + esc(ago(latest.date, now)).replace(/^([A-Z])/, function (c) { return c.toLowerCase(); }) + '</b>' +
      (n ? ' · ' + n + ' ' + monthWord + ' this month' : '');
  }

  function renderFeed(posts, opts) {
    posts = (posts || []).filter(function (p) { return p.status === 'live'; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return posts.map(function (p) { return render(p, opts); }).join('');
  }

  global.AGFeed = { render: render, renderFeed: renderFeed, pulse: pulse, ago: ago, kickFor: kickFor, SECTIONS: SECTIONS, COLUMNISTS: COLUMNISTS, MARK: MARK, esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
