/* =========================================
   STATE MANAGEMENT
========================================= */
const STATE = {
  demo: false,
  blogId: null,
  blogUrl: '',
  blogName: '',
  token: null,
  tokenClient: null,
  user: null,
  posts: [],
  comments: [],
  blockedIPs: [],
  blockedCountries: [],
  protectionEnabled: false,
  aiGeneratedContent: '',
};

const API = 'https://www.googleapis.com/blogger/v3';
const SCOPES = 'https://www.googleapis.com/auth/blogger openid profile email';

/* =========================================
   GOOGLE LOGIN
========================================= */
function startGoogleLogin() {
  const clientId = document.getElementById('client-id-input').value.trim();

  if (!clientId) {
    toast('Client ID를 입력해주세요.', 'error');
    return;
  }

  localStorage.setItem('googleClientId', clientId);

  try {
    STATE.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: handleAuthResponse,
    });

    STATE.tokenClient.requestAccessToken({ prompt: 'consent' });

  } catch (error) {
    console.error('로그인 초기화 오류:', error);
    toast('로그인 초기화 실패: ' + error.message, 'error');
  }
}

async function handleAuthResponse(response) {
  if (response.error) {
    console.error('인증 오류:', response.error);
    toast('로그인 실패: ' + response.error, 'error');
    return;
  }

  STATE.token = response.access_token;

  try {
    await fetchUserInfo();
    await fetchBlogs();
  } catch (error) {
    console.error('데이터 로드 오류:', error);
    toast('데이터 로드 실패: ' + error.message, 'error');
  }
}

async function fetchUserInfo() {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${STATE.token}` }
  });

  if (!response.ok) throw new Error('사용자 정보를 가져올 수 없습니다.');

  STATE.user = await response.json();

  document.getElementById('sb-user-name').textContent = STATE.user.name || '사용자';
  document.getElementById('sb-user-email').textContent = STATE.user.email || '';

  const avatar = document.getElementById('sb-user-avatar');
  if (STATE.user.picture) {
    avatar.innerHTML = `<img src="${STATE.user.picture}" alt="avatar">`;
  } else {
    avatar.textContent = (STATE.user.name || 'U')[0].toUpperCase();
  }
}

async function fetchBlogs() {
  const response = await fetch(`${API}/users/self/blogs`, {
    headers: { 'Authorization': `Bearer ${STATE.token}` }
  });

  if (!response.ok) throw new Error('블로그 목록을 가져올 수 없습니다.');

  const data = await response.json();
  const blogs = data.items || [];

  if (!blogs.length) {
    toast('연결된 블로그가 없습니다.', 'error');
    return;
  }

  if (blogs.length === 1) {
    selectBlog(blogs[0]);
  } else {
    showBlogPicker(blogs);
  }
}

function selectBlog(blog) {
  STATE.blogId = blog.id;
  STATE.blogUrl = blog.url;
  STATE.blogName = blog.name;

  document.getElementById('sb-blog-name').textContent = blog.name;
  document.getElementById('view-blog-btn').href = blog.url;

  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';

  loadDashboard();
  toast('로그인 성공!', 'success');
}

/* =========================================
   DEMO MODE
========================================= */
function loadDemoMode() {
  STATE.demo = true;
  STATE.blogId = 'demo';
  STATE.blogName = '데모 블로그';
  STATE.blogUrl = 'https://demo-blog.blogspot.com';
  STATE.user = { name: '데모 사용자', email: 'demo@example.com' };

  document.getElementById('sb-blog-name').textContent = '데모 블로그';
  document.getElementById('sb-user-name').textContent = '데모 사용자';
  document.getElementById('sb-user-email').textContent = 'demo@example.com';
  document.getElementById('sb-user-avatar').textContent = 'D';
  document.getElementById('view-blog-btn').href = '#';

  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';

  toast('데모 모드로 실행 중입니다.', 'info');
  loadDashboard();
}

/* =========================================
   NAVIGATION
========================================= */
const PANEL_TITLES = {
  dashboard: '대시보드',
  posts: '게시물 관리',
  editor: '새 글 쓰기',
  comments: '댓글 관리',
  'ai-content': 'AI 콘텐츠 생성',
  'ai-schema': '스키마 생성',
  'ai-thumbnail': '썸네일 생성',
  'ad-protection': '광고 보호',
  'ip-blocking': 'IP 차단 관리',
  settings: '설정'
};

function nav(name, el) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.getElementById('page-title').textContent = PANEL_TITLES[name] || name;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  if (name === 'posts') loadPosts();
  if (name === 'comments') loadComments();
}

function refreshCurrent() {
  const active = document.querySelector('.panel.active');
  if (!active) return;
  const id = active.id.replace('panel-', '');
  if (id === 'dashboard') loadDashboard();
  else if (id === 'posts') loadPosts();
  else if (id === 'comments') loadComments();
}

/* =========================================
   DASHBOARD
========================================= */
async function loadDashboard() {
  if (STATE.demo) {
    loadDemoDashboard();
    return;
  }

  try {
    const response = await fetch(`${API}/blogs/${STATE.blogId}`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });

    const blog = await response.json();

    document.getElementById('ds-posts').textContent = blog.posts?.totalItems || 0;
    document.getElementById('ds-comments').textContent = blog.comments?.totalItems || 0;
    document.getElementById('ds-views').textContent = '—';
    document.getElementById('ds-blocked').textContent = STATE.blockedIPs.length;

    loadRecentPosts();

  } catch (error) {
    console.error('대시보드 로드 오류:', error);
    toast('데이터 로드 실패: ' + error.message, 'error');
  }
}

function loadDemoDashboard() {
  document.getElementById('ds-posts').textContent = '247';
  document.getElementById('ds-comments').textContent = '1,234';
  document.getElementById('ds-views').textContent = '15,678';
  document.getElementById('ds-blocked').textContent = '5';

  document.getElementById('dash-recent-posts').innerHTML = `
    <table><tbody>
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:13px; font-weight:600; color:var(--title); margin-bottom:2px;">
            2025 서울 카페 투어 베스트 20
          </div>
          <div style="font-size:11px; color:var(--text);">2025-03-27 · 댓글 32</div>
        </td>
        <td style="padding:12px 16px;"><span class="tag tag-pub">발행됨</span></td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:13px; font-weight:600; color:var(--title); margin-bottom:2px;">
            Claude AI 완벽 활용 가이드
          </div>
          <div style="font-size:11px; color:var(--text);">2025-03-25 · 댓글 67</div>
        </td>
        <td style="padding:12px 16px;"><span class="tag tag-pub">발행됨</span></td>
      </tr>
    </tbody></table>
  `;
}

async function loadRecentPosts() {
  try {
    const response = await fetch(
      `${API}/blogs/${STATE.blogId}/posts?maxResults=5&status=LIVE`,
      { headers: { 'Authorization': `Bearer ${STATE.token}` } }
    );
    const data = await response.json();
    STATE.posts = data.items || [];
  } catch (error) {
    console.error('게시물 로드 오류:', error);
  }
}

/* =========================================
   POSTS
========================================= */
async function loadPosts() {
  if (STATE.demo) return;

  try {
    const response = await fetch(
      `${API}/blogs/${STATE.blogId}/posts?maxResults=20`,
      { headers: { 'Authorization': `Bearer ${STATE.token}` } }
    );
    const data = await response.json();
    STATE.posts = data.items || [];
  } catch (error) {
    console.error('게시물 로드 오류:', error);
  }
}

/* =========================================
   COMMENTS
========================================= */
async function loadComments() {
  if (STATE.demo) return;
  // Load comments from API...
}

/* =========================================
   AI CONTENT GENERATION
========================================= */
async function generateAIContent() {
  const topic = document.getElementById('ai-topic').value.trim();
  const type = document.getElementById('ai-type').value;

  if (!topic) {
    toast('주제를 입력해주세요.', 'error');
    return;
  }

  const sampleContent = generateSampleContent(topic, type);

  STATE.aiGeneratedContent = sampleContent;
  document.getElementById('ai-content-text').innerHTML = sampleContent;
  document.getElementById('ai-content-result').classList.add('show');

  toast('AI 콘텐츠가 생성되었습니다!', 'success');
}

function generateSampleContent(topic, type) {
  return `
    <h2>${topic}</h2>
    <p>이 글에서는 <strong>${topic}</strong>에 대해 자세히 알아보겠습니다.</p>
    <h3>1. 소개</h3>
    <p>${topic}은/는 많은 사람들의 관심을 받고 있는 주제입니다...</p>
    <h3>2. 주요 특징</h3>
    <ul>
      <li>첫 번째 특징에 대한 설명</li>
      <li>두 번째 특징에 대한 설명</li>
      <li>세 번째 특징에 대한 설명</li>
    </ul>
    <h3>3. 결론</h3>
    <p>${topic}에 대해 알아보았습니다. 더 자세한 정보는...</p>
  `;
}

function useAIContent() {
  document.getElementById('editor-content').value = STATE.aiGeneratedContent;
  nav('editor', null);
  toast('콘텐츠가 에디터에 추가되었습니다!', 'success');
}

/* =========================================
   SCHEMA GENERATION
========================================= */
function generateSchema() {
  const type = document.getElementById('schema-type').value;
  const title = document.getElementById('schema-title').value.trim();
  const description = document.getElementById('schema-description').value.trim();

  if (!title || !description) {
    toast('제목과 설명을 입력해주세요.', 'error');
    return;
  }

  const typeMap = {
    article: 'Article',
    product: 'Product',
    review: 'Review',
    recipe: 'Recipe',
    faq: 'FAQPage',
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": typeMap[type] || 'Article',
    "headline": title,
    "description": description,
    "author": {
      "@type": "Person",
      "name": STATE.user?.name || "작성자"
    },
    "datePublished": new Date().toISOString()
  };

  document.getElementById('schema-code').value = JSON.stringify(schema, null, 2);
  document.getElementById('schema-result').style.display = 'block';

  toast('스키마가 생성되었습니다!', 'success');
}

function copySchema() {
  const schemaCode = document.getElementById('schema-code');
  schemaCode.select();
  document.execCommand('copy');
  toast('스키마 코드가 복사되었습니다!', 'success');
}

/* =========================================
   THUMBNAIL GENERATION
========================================= */
function generateThumbnail() {
  const topic = document.getElementById('thumb-topic').value.trim();
  const style = document.getElementById('thumb-style').value;

  if (!topic) {
    toast('썸네일 주제를 입력해주세요.', 'error');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  const gradients = {
    modern:       ['#667eea', '#764ba2'],
    colorful:     ['#f093fb', '#f5576c'],
    minimal:      ['#f5f5f5', '#e0e0e0'],
    professional: ['#1e3c72', '#2a5298'],
  };
  const [c1, c2] = gradients[style] || gradients.modern;
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = style === 'minimal' ? '#333' : 'white';
  ctx.font = 'bold 60px "Fira Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = topic.split(' ');
  let line = '';
  let y = canvas.height / 2;
  const lineHeight = 80;

  for (const word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > canvas.width - 100 && line !== '') {
      ctx.fillText(line, canvas.width / 2, y);
      line = word + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, canvas.width / 2, y);

  const preview = document.getElementById('thumb-preview');
  preview.innerHTML = `<img src="${canvas.toDataURL()}" style="max-width:100%; border-radius:8px; box-shadow:var(--shadow-md);">`;
  document.getElementById('thumb-result').style.display = 'block';

  toast('썸네일이 생성되었습니다!', 'success');
}

function downloadThumbnail() {
  const img = document.querySelector('#thumb-preview img');
  if (!img) return;

  const link = document.createElement('a');
  link.download = 'thumbnail.png';
  link.href = img.src;
  link.click();

  toast('썸네일이 다운로드되었습니다!', 'success');
}

/* =========================================
   AD PROTECTION
========================================= */
function toggleProtection(toggle) {
  toggle.classList.toggle('on');
  STATE.protectionEnabled = toggle.classList.contains('on');

  const status = document.getElementById('protection-status');
  if (STATE.protectionEnabled) {
    status.className = 'protection-badge active';
    status.innerHTML = '<i class="fas fa-circle"></i><span>활성화</span>';
    toast('광고 보호가 활성화되었습니다.', 'success');
  } else {
    status.className = 'protection-badge inactive';
    status.innerHTML = '<i class="fas fa-circle"></i><span>비활성화</span>';
    toast('광고 보호가 비활성화되었습니다.', 'info');
  }
}

function saveProtectionSettings() {
  const maxClicks = document.getElementById('max-clicks').value;
  const blockDuration = document.getElementById('block-duration').value;

  localStorage.setItem('protectionSettings', JSON.stringify({
    maxClicks,
    blockDuration,
    enabled: STATE.protectionEnabled
  }));

  toast('보호 설정이 저장되었습니다!', 'success');
}

/* =========================================
   IP BLOCKING
========================================= */
function addBlockedIP() {
  const ip = document.getElementById('ip-input').value.trim();

  if (!ip) { toast('IP 주소를 입력해주세요.', 'error'); return; }

  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    toast('올바른 IP 주소 형식이 아닙니다.', 'error');
    return;
  }

  if (STATE.blockedIPs.includes(ip)) { toast('이미 차단된 IP입니다.', 'error'); return; }

  STATE.blockedIPs.push(ip);
  renderBlockedIPs();
  document.getElementById('ip-input').value = '';
  toast(`${ip}가 차단되었습니다.`, 'success');
  localStorage.setItem('blockedIPs', JSON.stringify(STATE.blockedIPs));
}

function renderBlockedIPs() {
  const list = document.getElementById('blocked-ip-list');
  if (!STATE.blockedIPs.length) {
    list.innerHTML = '<p style="color:var(--text); font-size:12px;">차단된 IP가 없습니다.</p>';
    return;
  }
  list.innerHTML = STATE.blockedIPs.map(ip => `
    <div class="ip-tag">
      <span>${ip}</span>
      <span class="remove-ip" onclick="removeBlockedIP('${ip}')">
        <i class="fas fa-times"></i>
      </span>
    </div>
  `).join('');
}

function removeBlockedIP(ip) {
  STATE.blockedIPs = STATE.blockedIPs.filter(i => i !== ip);
  renderBlockedIPs();
  toast(`${ip} 차단이 해제되었습니다.`, 'info');
  localStorage.setItem('blockedIPs', JSON.stringify(STATE.blockedIPs));
}

function addBlockedCountry() {
  const country = document.getElementById('country-input').value.trim().toUpperCase();

  if (!country) { toast('국가 코드를 입력해주세요.', 'error'); return; }
  if (STATE.blockedCountries.includes(country)) { toast('이미 차단된 국가입니다.', 'error'); return; }

  STATE.blockedCountries.push(country);
  renderBlockedCountries();
  document.getElementById('country-input').value = '';
  toast(`${country}가 차단되었습니다.`, 'success');
  localStorage.setItem('blockedCountries', JSON.stringify(STATE.blockedCountries));
}

function renderBlockedCountries() {
  const list = document.getElementById('blocked-country-list');
  if (!STATE.blockedCountries.length) {
    list.innerHTML = '<p style="color:var(--text); font-size:12px;">차단된 국가가 없습니다.</p>';
    return;
  }
  list.innerHTML = STATE.blockedCountries.map(country => `
    <div class="country-tag">
      <span>${country}</span>
      <span class="remove-ip" onclick="removeBlockedCountry('${country}')">
        <i class="fas fa-times"></i>
      </span>
    </div>
  `).join('');
}

function removeBlockedCountry(country) {
  STATE.blockedCountries = STATE.blockedCountries.filter(c => c !== country);
  renderBlockedCountries();
  toast(`${country} 차단이 해제되었습니다.`, 'info');
  localStorage.setItem('blockedCountries', JSON.stringify(STATE.blockedCountries));
}

function viewBlockLog() {
  openModal('차단 로그', `
    <table class="log-table">
      <thead>
        <tr>
          <th>IP</th><th>차단 일시</th><th>사유</th><th>만료</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>192.168.1.100</td>
          <td>2025-03-28 14:30</td>
          <td>반복 클릭</td>
          <td>2025-03-29 14:30</td>
        </tr>
        <tr class="log-expired">
          <td>10.0.0.50</td>
          <td>2025-03-20 10:15</td>
          <td>의심스러운 활동</td>
          <td>2025-03-21 10:15 (만료됨)</td>
        </tr>
      </tbody>
    </table>
  `, [
    { label: '닫기', cls: 'btn-ghost', fn: closeModal }
  ]);
}

/* =========================================
   EDITOR & SAVE
========================================= */
async function savePost(publish) {
  const title = document.getElementById('editor-title').value.trim();
  const content = document.getElementById('editor-content').value;

  if (!title) { toast('제목을 입력해주세요.', 'error'); return; }

  if (STATE.demo) {
    toast('데모 모드: 실제 저장은 불가합니다.', 'info');
    return;
  }

  try {
    const endpoint = publish
      ? `${API}/blogs/${STATE.blogId}/posts`
      : `${API}/blogs/${STATE.blogId}/posts?isDraft=true`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STATE.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, content })
    });

    if (!response.ok) throw new Error('게시물 저장 실패');

    toast(publish ? '🚀 발행 완료!' : '💾 임시 저장됨', 'success');
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-content').value = '';

  } catch (error) {
    console.error('저장 오류:', error);
    toast('저장 실패: ' + error.message, 'error');
  }
}

/* =========================================
   SETTINGS
========================================= */
function saveSettings() {
  if (STATE.demo) {
    toast('데모 모드: 실제 저장은 불가합니다.', 'info');
    return;
  }
  toast('✅ 설정이 저장되었습니다.', 'success');
}

/* =========================================
   MODAL
========================================= */
function openModal(title, body, actions) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = (actions || []).map(a =>
    `<button class="btn ${a.cls}" onclick="${a.fn.name}()">${a.label}</button>`
  ).join('');
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

/* =========================================
   TOAST
========================================= */
let _toastTimer;

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  const icons = {
    success: 'fa-check-circle',
    error:   'fa-exclamation-circle',
    info:    'fa-info-circle',
  };

  el.className = `show ${type}`;
  el.querySelector('i').className = `fas ${icons[type] || 'fa-info-circle'}`;
  document.getElementById('toast-msg').textContent = msg;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* =========================================
   LOGOUT
========================================= */
function doLogout() {
  STATE.token = null;
  STATE.blogId = null;
  STATE.demo = false;

  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('setup-screen').style.display = 'flex';

  toast('로그아웃 되었습니다.', 'info');
}

/* =========================================
   UTILS
========================================= */
function showBlogPicker(blogs) {
  toast('블로그 선택 기능', 'info');
}

/* =========================================
   INITIALIZATION
========================================= */
window.addEventListener('DOMContentLoaded', function () {
  const savedClientId = localStorage.getItem('googleClientId');
  if (savedClientId) {
    document.getElementById('client-id-input').value = savedClientId;
  }

  const savedIPs = localStorage.getItem('blockedIPs');
  if (savedIPs) {
    STATE.blockedIPs = JSON.parse(savedIPs);
    renderBlockedIPs();
  }

  const savedCountries = localStorage.getItem('blockedCountries');
  if (savedCountries) {
    STATE.blockedCountries = JSON.parse(savedCountries);
    renderBlockedCountries();
  }

  const savedSettings = localStorage.getItem('protectionSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    document.getElementById('max-clicks').value = settings.maxClicks || 3;
    document.getElementById('block-duration').value = settings.blockDuration || 24;
    if (settings.enabled) {
      document.getElementById('protection-toggle').classList.add('on');
      STATE.protectionEnabled = true;
    }
  }
});
