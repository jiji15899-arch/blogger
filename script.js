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
  blogs: [],
  posts: [],
  comments: [],
  blockedIPs: [],
  blockedCountries: [],
  protectionEnabled: false,
  aiGeneratedContent: '',
  geminiApiKey: '',
  cfWorkerUrl: '',
  aiPanelOpen: false,
};

const API = 'https://www.googleapis.com/blogger/v3';
const SCOPES = 'https://www.googleapis.com/auth/blogger openid profile email';
const GEMINI_MODEL = 'gemini-2.0-flash';

/* =========================================
   GOOGLE LOGIN
========================================= */
function startGoogleLogin() {
  const clientId = document.getElementById('client-id-input').value.trim();
  if (!clientId) { toast('Client ID를 입력해주세요.', 'error'); return; }
  localStorage.setItem('googleClientId', clientId);
  try {
    STATE.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: handleAuthResponse,
    });
    STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (error) {
    toast('로그인 초기화 실패: ' + error.message, 'error');
  }
}

async function handleAuthResponse(response) {
  if (response.error) {
    toast('로그인 실패: ' + response.error, 'error');
    return;
  }
  STATE.token = response.access_token;
  try {
    await fetchUserInfo();
    await fetchBlogs();
  } catch (error) {
    toast('데이터 로드 실패: ' + error.message, 'error');
  }
}

async function fetchUserInfo() {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${STATE.token}` }
  });
  if (!res.ok) throw new Error('사용자 정보를 가져올 수 없습니다.');
  STATE.user = await res.json();
  document.getElementById('sb-user-name').textContent = STATE.user.name || '사용자';
  document.getElementById('sb-user-email').textContent = STATE.user.email || '';
  const avatar = document.getElementById('sb-user-avatar');
  if (STATE.user.picture) {
    avatar.innerHTML = `<img src="${STATE.user.picture}" alt="avatar" style="width:100%;height:100%;border-radius:50%;">`;
  } else {
    avatar.textContent = (STATE.user.name || 'U')[0].toUpperCase();
  }
}

async function fetchBlogs() {
  const res = await fetch(`${API}/users/self/blogs`, {
    headers: { Authorization: `Bearer ${STATE.token}` }
  });
  if (!res.ok) throw new Error('블로그 목록을 가져올 수 없습니다.');
  const data = await res.json();
  STATE.blogs = data.items || [];
  if (!STATE.blogs.length) {
    toast('연결된 블로그가 없습니다.', 'error');
    return;
  }
  if (STATE.blogs.length === 1) {
    selectBlog(STATE.blogs[0]);
  } else {
    showBlogPickerModal(STATE.blogs);
  }
}

function selectBlog(blog) {
  STATE.blogId = blog.id;
  STATE.blogUrl = blog.url;
  STATE.blogName = blog.name;
  document.getElementById('sb-blog-name').textContent = blog.name;
  document.getElementById('view-blog-btn').href = blog.url;
  // 셋업 숨기고 어드민 표시
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  loadDashboard();
  toast('로그인 성공! ' + blog.name, 'success');
}

/* =========================================
   BLOG PICKER MODAL
========================================= */
function showBlogPickerModal(blogs) {
  const items = blogs.map((b, i) => `
    <div onclick="pickBlog(${i})" style="
      padding:14px 16px; cursor:pointer; border-radius:8px;
      border:1px solid var(--border); margin-bottom:8px;
      transition:all .15s; background:var(--card);"
      onmouseover="this.style.borderColor='var(--main)';this.style.background='#f0f4ff'"
      onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--card)'">
      <div style="font-weight:600;color:var(--title);font-size:14px;">${b.name}</div>
      <div style="font-size:12px;color:var(--text);margin-top:2px;">${b.url}</div>
    </div>`).join('');
  openModal('블로그 선택', `<p style="color:var(--text);font-size:13px;margin-bottom:14px;">연결된 블로그 ${blogs.length}개가 있습니다. 관리할 블로그를 선택하세요.</p>${items}`, []);
}

function pickBlog(idx) {
  closeModal();
  selectBlog(STATE.blogs[idx]);
}

function openBlogPicker() {
  if (STATE.demo) { toast('데모 모드입니다.', 'info'); return; }
  if (STATE.blogs.length > 0) showBlogPickerModal(STATE.blogs);
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
  const panel = document.getElementById('panel-' + name);
  if (panel) panel.classList.add('active');
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
   EDITOR AI PANEL TOGGLE
========================================= */
function toggleAIPanel() {
  STATE.aiPanelOpen = !STATE.aiPanelOpen;
  const layout = document.getElementById('editor-layout');
  const panel = document.getElementById('editor-ai-panel');
  const btn = document.getElementById('ai-panel-toggle');
  if (STATE.aiPanelOpen) {
    layout.classList.add('ai-open');
    panel.classList.add('visible');
    btn.classList.add('btn-outline');
    btn.style.color = 'var(--main)';
    btn.style.borderColor = 'var(--main)';
  } else {
    layout.classList.remove('ai-open');
    panel.classList.remove('visible');
    btn.classList.remove('btn-outline');
    btn.style.color = '';
    btn.style.borderColor = '';
  }
}

function switchAITab(name, el) {
  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const tc = document.getElementById('aitab-' + name);
  if (tc) tc.classList.add('active');
}

/* =========================================
   DASHBOARD
========================================= */
async function loadDashboard() {
  if (STATE.demo) { loadDemoDashboard(); return; }
  try {
    const res = await fetch(`${API}/blogs/${STATE.blogId}`, {
      headers: { Authorization: `Bearer ${STATE.token}` }
    });
    const blog = await res.json();
    document.getElementById('ds-posts').textContent = blog.posts?.totalItems || 0;
    document.getElementById('ds-comments').textContent = blog.comments?.totalItems || 0;
    document.getElementById('ds-views').textContent = '—';
    document.getElementById('ds-blocked').textContent = STATE.blockedIPs.length;
    loadRecentPosts();
  } catch (e) {
    toast('대시보드 로드 실패: ' + e.message, 'error');
  }
}

function loadDemoDashboard() {
  document.getElementById('ds-posts').textContent = '247';
  document.getElementById('ds-comments').textContent = '1,234';
  document.getElementById('ds-views').textContent = '15,678';
  document.getElementById('ds-blocked').textContent = STATE.blockedIPs.length;
  document.getElementById('dash-recent-posts').innerHTML = `
    <table><tbody>
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:13px;font-weight:600;color:var(--title);margin-bottom:2px;">2025 서울 카페 투어 베스트 20</div>
          <div style="font-size:11px;color:var(--text);">2025-03-27 · 댓글 32</div>
        </td>
        <td style="padding:12px 16px;"><span class="tag tag-pub">발행됨</span></td>
      </tr>
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:13px;font-weight:600;color:var(--title);margin-bottom:2px;">Claude AI 완벽 활용 가이드</div>
          <div style="font-size:11px;color:var(--text);">2025-03-25 · 댓글 67</div>
        </td>
        <td style="padding:12px 16px;"><span class="tag tag-pub">발행됨</span></td>
      </tr>
    </tbody></table>`;
}

async function loadRecentPosts() {
  try {
    const res = await fetch(`${API}/blogs/${STATE.blogId}/posts?maxResults=5&status=LIVE`, {
      headers: { Authorization: `Bearer ${STATE.token}` }
    });
    const data = await res.json();
    STATE.posts = data.items || [];
    const tbody = document.getElementById('dash-recent-posts');
    if (!STATE.posts.length) {
      tbody.innerHTML = '<p style="padding:16px;color:var(--text);font-size:13px;">게시물이 없습니다.</p>';
      return;
    }
    tbody.innerHTML = `<table><tbody>${STATE.posts.map(p => `
      <tr>
        <td style="padding:12px 16px;">
          <div style="font-size:13px;font-weight:600;color:var(--title);margin-bottom:2px;">${p.title}</div>
          <div style="font-size:11px;color:var(--text);">${p.published?.slice(0,10) || ''}</div>
        </td>
        <td style="padding:12px 16px;"><span class="tag tag-pub">발행됨</span></td>
      </tr>`).join('')}</tbody></table>`;
  } catch (e) {}
}

/* =========================================
   POSTS
========================================= */
async function loadPosts() {
  if (STATE.demo) return;
  try {
    const res = await fetch(`${API}/blogs/${STATE.blogId}/posts?maxResults=20`, {
      headers: { Authorization: `Bearer ${STATE.token}` }
    });
    const data = await res.json();
    STATE.posts = data.items || [];
    renderPostsTable();
  } catch (e) {
    toast('게시물 로드 실패: ' + e.message, 'error');
  }
}

function renderPostsTable() {
  const tbody = document.getElementById('posts-table-body');
  if (!STATE.posts.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text);">게시물이 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = STATE.posts.map(p => `
    <tr>
      <td style="padding:12px 16px;max-width:300px;">
        <div style="font-weight:600;color:var(--title);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.title}</div>
      </td>
      <td style="padding:12px 16px;"><span class="tag tag-pub">발행됨</span></td>
      <td style="padding:12px 16px;font-size:12px;color:var(--text);">${p.published?.slice(0,10) || '—'}</td>
      <td style="padding:12px 16px;">
        <a href="${p.url}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;">보기</a>
        <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="editPost('${p.id}','${p.title.replace(/'/g,"\\'")}')">수정</button>
      </td>
    </tr>`).join('');
}

function editPost(id, title) {
  const p = STATE.posts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('editor-title').value = p.title;
  document.getElementById('editor-content').value = p.content || '';
  nav('editor', null);
  toast('게시물을 불러왔습니다.', 'info');
}

/* =========================================
   COMMENTS
========================================= */
async function loadComments() {
  if (STATE.demo) return;
}

/* =========================================
   EDITOR — SAVE
========================================= */
async function savePost(publish) {
  const title = document.getElementById('editor-title').value.trim();
  const content = document.getElementById('editor-content').value;
  if (!title) { toast('제목을 입력해주세요.', 'error'); return; }
  if (STATE.demo) { toast('데모 모드: 실제 저장은 불가합니다.', 'info'); return; }
  try {
    const url = publish
      ? `${API}/blogs/${STATE.blogId}/posts`
      : `${API}/blogs/${STATE.blogId}/posts?isDraft=true`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${STATE.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });
    if (!res.ok) throw new Error('저장 실패');
    toast(publish ? '🚀 발행 완료!' : '💾 임시 저장됨', 'success');
    document.getElementById('editor-title').value = '';
    document.getElementById('editor-content').value = '';
  } catch (e) {
    toast('저장 실패: ' + e.message, 'error');
  }
}

/* =========================================
   GEMINI API CALL
========================================= */
async function callGemini(prompt, temperature = 0.85, maxTokens = 8192) {
  const key = STATE.geminiApiKey;
  if (!key) throw new Error('Gemini API 키가 설정되지 않았습니다. 설정 > AI API 설정에서 입력해주세요.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.9 },
    tools: [{ google_search: {} }]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 ${res.status}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || '').join('');
}

async function callGeminiJSON(prompt, maxTokens = 3000) {
  const key = STATE.geminiApiKey;
  if (!key) throw new Error('Gemini API 키가 설정되지 않았습니다.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      topP: 0.8,
      responseMimeType: 'application/json'
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 ${res.status}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let text = parts.map(p => p.text || '').join('');
  text = text.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(text);
}

/* =========================================
   BUILD CONTENT PROMPT (aibp-pro 동일)
========================================= */
function buildContentPrompt(topic, type) {
  const date = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' });
  const ts = Date.now();
  const seed = ts % 20;

  const intros = [
    '도입부A: 독자가 지금 막 겪는 구체적 상황을 2문장으로 묘사하고 즉시 핵심 정보로 전환',
    '도입부B: 가장 흔한 실수 2가지를 먼저 짚고 올바른 방법으로 자연 전환',
    '도입부C: 핵심 수치(금액/기간/비율)를 첫 문장에 배치 — 역피라미드 결론 먼저',
    '도입부D: 이 글에서 다룰 3가지 핵심 포인트를 첫 단락에 명시하는 약속형',
    '도입부E: 실무 경험자 관점의 1인칭 사례 소개 → E-E-A-T 신뢰 즉시 구축',
    '도입부F: 독자가 검색창에 치는 질문 그 자체로 시작 → 즉시 답변 제공',
    '도입부G: 최신 변화·정책 변경 강조 → 신선도 어필로 클릭 유지',
    '도입부H: 비용 절감·시간 단축·리스크 회피 3가지 실익을 수치와 함께 배치',
    '도입부I: 흔한 오해를 먼저 지적하고 실제와 대비하는 교정 구조',
    '도입부J: 자가진단 체크리스트 3항목으로 시작 → 해당되면 이 글이 필요하다는 흐름',
    '도입부K: 최근 통계·연구 수치로 시작 → 신뢰도와 검색 의도 동시 공략',
    '도입부L: 성공 사례(구체적 숫자)와 실패 사례를 대조하는 스토리텔링',
    '도입부M: 비교 대상 2~3가지를 첫 문단에 나열 → 선택 의도 직격',
    '도입부N: 독자가 얻는 구체적 이득을 약속 형식으로 명시',
    '도입부O: 시간순 흐름 → 변화 맥락으로 필요성 설득',
    '도입부P: 한 줄 요약(TL;DR) 먼저 제시 후 심화 전개',
    '도입부Q: 독자가 실제로 궁금해하는 생활 밀착형 질문으로 시작',
    '도입부R: 주변 사람 사례를 들어 공감 확보 후 해결책 제시',
    '도입부S: 관련 제도·정책의 핵심 변경 사항을 첫 줄에 배치',
    '도입부T: 이 주제를 모르면 손해 보는 이유를 3줄로 압축해 위기감 조성',
  ];
  const intro = intros[seed];

  const typeGuides = {
    informational: `
【정보성 — 2026 Elite SEO Content Specialist + 네이버 웹문서 1위 + 애드센스 수익화 극대화】
- 연관 키워드 30개 이상 본문 전체 자연 분산 / '|' 절대 금지 / 연도 삽입 절대 금지
- 도입부 <p> 1개 (2~3문장) → 본론 H2 3개 이상 (FAQ 포함 총 4개 이상)
- 각 H2 내부 H3 반드시 2~3개 / H3 직후 <p> 1~3문장 → <ul> li 최소 3개
- <table> 완전 금지 / FAQ 4~6개 필수 / 끝인사 금지
- <strong> 섹션당 2~4개 (수치·키워드) / <u> 섹션당 1~2개 (용어·브랜드명)
- 고단가 키워드(금융·보험·건강·법률) 자연 배치 — 본문 3~5회`,
    utility: `
【유틸리티 — 표 2개 필수(도입부 직후) + 네이버 웹문서 1위 + 애드센스 최적화】
- 핵심 동작 동사 필수: 다운로드·설치·신청·발급·방법
- 도입부 <p> 1개 → 표1(기본정보: 카테고리·운영체제·개발사·비용) 필수 → 표2(사양·조건) 필수 → 본론 H2
- 각 H2 내부 H3 2~3개 / H3 직후 <p> → <ul> 또는 <ol> (li 3개 이상)
- 설치·신청 단계는 <ol> 사용 / 전문 용어 즉시 괄호로 쉬운 말 병기
- FAQ 4~6개 필수 / 끝인사 금지`,
    policy_guide: `
【정책·공공 — 표 선택사항(최대 2개) + 네이버 웹문서 1위 + 애드센스 최적화】
- 정확한 공공 정보 신뢰도 높게 전달 / 허위·과장 표현 금지 / 검증 가능한 수치만
- 도입부 <p> 1개 (핵심 혜택 수치 먼저) → 선택적 표(대상·조건·금액·기간) → 본론 H2
- 각 H2 내부 H3 2~3개 / <strong> 지원금액·신청기간·자격조건 강조
- FAQ 4~6개 필수 / 끝인사 금지
- 정부 지원 관련 고단가 금융·법률 키워드 자연 배치`,
    review_comparison: `
【리뷰·비교 — 쿠팡파트너스 최적화 + 애드센스 문맥 매칭 극대화】
- 제품명·모델명 구체적 기재 / 가격 정보(쿠팡 기준) 반드시 포함
- 각 H3 섹션 하단 <ul> 마지막 li: 쿠팡에서 최저가 확인 안내 문구 삽입
- '로켓배송', '쿠팡 최저가', '쿠팡 할인' 키워드 본문 3~5회 자연 배치
- 도입부 <p> 1개 → 본론 H2 3개 이상 (각 H2: H3 2~3개)
- <table> 완전 금지 — 모든 비교는 <ul>/<ol>로만 / FAQ 4~6개 필수 / 끝인사 금지
- <strong> 가격·평점·핵심기능 수치 강조 / <u> 제품명·브랜드명`
  };

  const guide = typeGuides[type] || typeGuides.informational;

  return `당신은 2026 Elite SEO Content Specialist입니다. 구글·네이버·빙 최적화 + 애드센스 수익화에 특화된 한국어 SEO 블로그 전문 작가입니다.

오늘 날짜: ${date} / 주제: '${topic}' / 글 유형: ${type}
${intro}

⚡ Google Search 결과를 바탕으로 최신 수치·정책·가격을 반영하세요.

${guide}

━━ 절대 준수 ━━
- 한자 0개 / 별표(*) 0개 / 마크다운 문법 0개
- 본문 내 <h1> / <h4> / <title> 태그 절대 금지
- 이미지 URL 금지 → HTML 주석으로만: <!-- [이미지 위치] alt: [${topic} 관련 이미지] -->
- 유사문서 생성 절대 금지 / 탬플릿식 글쓰기 금지
- FAQ 포함 H2 총 4개 이상 / 본론 H2 3개 이상

━━ H2 규칙 ━━
- FAQ H2 포함 총 H2 반드시 4개 이상
- <h2>자주 묻는 질문</h2> 반드시 포함 (4~6개 Q&A)
- 각 Q: <h3>질문?</h3> / 각 A: <p>2~4문장</p>

━━ 출력 형식 ━━
가장 먼저 메타 정보를 아래 형식으로 출력하고, 그 다음 본문 HTML을 출력하세요:

[META_START]
SEO_TITLE: (제목 — '|' 금지, 연도 금지)
META_DESC: (120~160자 메타 디스크립션)
[META_END]

그 다음 바로 본문 HTML (h1 태그 제외, <h2>부터 시작):`;
}

/* =========================================
   AI CONTENT GENERATION (공통)
========================================= */
async function runAIGenerate({ topic, type, progressEl, fillEl, labelEl, pctEl, genBtn, resultEl, previewEl, rawEl }) {
  if (!topic) { toast('주제를 입력해주세요.', 'error'); return null; }
  if (!STATE.geminiApiKey) { toast('Gemini API 키를 설정 페이지에서 먼저 입력해주세요.', 'error'); nav('settings', null); return null; }

  // UI 시작
  if (genBtn) { document.getElementById(genBtn).disabled = true; document.getElementById(genBtn).innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...'; }
  if (progressEl) document.getElementById(progressEl).style.display = 'block';
  if (resultEl) document.getElementById(resultEl).style.display = 'none';

  // 진행률 애니메이션
  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(pct + (pct < 30 ? 3 : pct < 70 ? 1.5 : 0.5), 90);
    if (fillEl) document.getElementById(fillEl).style.width = pct + '%';
    if (pctEl) document.getElementById(pctEl).textContent = Math.round(pct) + '%';
    const labels = ['AI 처리 시작 중','키워드 분석 중','콘텐츠 구조 설계 중','본문 생성 중','SEO 최적화 중','마무리 중'];
    if (labelEl) document.getElementById(labelEl).textContent = labels[Math.min(Math.floor(pct/18), labels.length-1)];
  }, 400);

  try {
    const prompt = buildContentPrompt(topic, type);
    const raw = await callGemini(prompt, 0.85, 8192);

    // 메타 정보 파싱
    let html = raw;
    let meta = {};
    const metaMatch = raw.match(/\[META_START\]([\s\S]*?)\[META_END\]/);
    if (metaMatch) {
      const metaBlock = metaMatch[1];
      const titleMatch = metaBlock.match(/SEO_TITLE:\s*(.+)/);
      const descMatch  = metaBlock.match(/META_DESC:\s*(.+)/);
      if (titleMatch) meta.title = titleMatch[1].trim();
      if (descMatch)  meta.desc  = descMatch[1].trim();
      html = raw.replace(/\[META_START\][\s\S]*?\[META_END\]/, '').trim();
    }

    // 클린업
    html = html.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/gs, '$1');
    html = html.replace(/\*/g, '');
    html = html.replace(/<h4([^>]*)>/gi, '<h3$1>').replace(/<\/h4>/gi, '</h3>');
    html = html.replace(/<h1[^>]*>.*?<\/h1>/gis, '');

    clearInterval(timer);
    if (fillEl) document.getElementById(fillEl).style.width = '100%';
    if (pctEl) document.getElementById(pctEl).textContent = '100%';
    if (labelEl) document.getElementById(labelEl).textContent = '완료!';
    setTimeout(() => { if (progressEl) document.getElementById(progressEl).style.display = 'none'; }, 800);

    STATE.aiGeneratedContent = html;

    // 미리보기/결과
    if (previewEl) document.getElementById(previewEl).innerHTML = html;
    if (rawEl) document.getElementById(rawEl).innerHTML = html;
    if (resultEl) document.getElementById(resultEl).style.display = 'block';

    // 제목 자동 입력 (에디터)
    if (meta.title && document.getElementById('editor-title') && !document.getElementById('editor-title').value) {
      document.getElementById('editor-title').value = meta.title;
    }

    toast('✅ AI 콘텐츠 생성 완료!', 'success');
    return { html, meta };

  } catch (e) {
    clearInterval(timer);
    if (progressEl) document.getElementById(progressEl).style.display = 'none';
    toast('생성 실패: ' + e.message, 'error');
    return null;
  } finally {
    if (genBtn) {
      document.getElementById(genBtn).disabled = false;
      document.getElementById(genBtn).innerHTML = '<i class="fas fa-magic"></i> AI 글 생성';
    }
  }
}

/* =========================================
   EDITOR AI — 글 생성
========================================= */
async function editorGenerateContent() {
  const topic = document.getElementById('ep-topic').value.trim();
  const type  = document.getElementById('ep-post-type').value;
  await runAIGenerate({
    topic, type,
    progressEl: 'ep-progress',
    fillEl: 'ep-fill',
    labelEl: 'ep-label',
    pctEl: 'ep-pct',
    genBtn: 'ep-gen-btn',
    resultEl: 'ep-result',
    previewEl: 'ep-preview',
    rawEl: null
  });
}

function applyAIToEditor() {
  if (!STATE.aiGeneratedContent) return;
  document.getElementById('editor-content').value = STATE.aiGeneratedContent;
  toast('에디터에 적용했습니다!', 'success');
}

function copyAIContent() {
  if (!STATE.aiGeneratedContent) return;
  navigator.clipboard.writeText(STATE.aiGeneratedContent)
    .then(() => toast('콘텐츠가 복사되었습니다!', 'success'))
    .catch(() => { toast('복사 실패. 수동으로 선택해 복사하세요.', 'error'); });
}

/* =========================================
   AI CONTENT 페이지 — 글 생성
========================================= */
async function generateAIContent() {
  const topic = document.getElementById('ai-topic').value.trim();
  const type  = document.getElementById('ai-post-type').value;

  if (!topic) { toast('주제를 입력해주세요.', 'error'); return; }
  if (!STATE.geminiApiKey) { toast('Gemini API 키를 설정 페이지에서 먼저 입력해주세요.', 'error'); nav('settings', null); return; }

  const btn = document.getElementById('ai-content-gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  document.getElementById('ai-content-progress').style.display = 'block';
  document.getElementById('ai-content-result').classList.remove('show');

  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(pct + (pct < 30 ? 3 : pct < 70 ? 1.5 : 0.5), 90);
    document.getElementById('ai-content-fill').style.width = pct + '%';
    document.getElementById('ai-content-pct').textContent = Math.round(pct) + '%';
    const labels = ['AI 처리 시작 중','키워드 분석 중','콘텐츠 구조 설계 중','본문 생성 중','SEO 최적화 중','마무리 중'];
    document.getElementById('ai-content-label').textContent = labels[Math.min(Math.floor(pct/18), labels.length-1)];
  }, 400);

  try {
    const prompt = buildContentPrompt(topic, type);
    const raw = await callGemini(prompt, 0.85, 8192);

    let html = raw;
    const metaMatch = raw.match(/\[META_START\]([\s\S]*?)\[META_END\]/);
    if (metaMatch) {
      html = raw.replace(/\[META_START\][\s\S]*?\[META_END\]/, '').trim();
    }
    html = html.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>').replace(/\*/g, '');
    html = html.replace(/<h4([^>]*)>/gi, '<h3$1>').replace(/<\/h4>/gi, '</h3>');
    html = html.replace(/<h1[^>]*>.*?<\/h1>/gis, '');

    clearInterval(timer);
    document.getElementById('ai-content-fill').style.width = '100%';
    document.getElementById('ai-content-pct').textContent = '100%';
    setTimeout(() => { document.getElementById('ai-content-progress').style.display = 'none'; }, 800);

    STATE.aiGeneratedContent = html;
    document.getElementById('ai-content-text').innerHTML = html;
    document.getElementById('ai-content-result').classList.add('show');
    toast('✅ AI 콘텐츠 생성 완료!', 'success');
  } catch (e) {
    clearInterval(timer);
    document.getElementById('ai-content-progress').style.display = 'none';
    toast('생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> 생성하기';
  }
}

function useAIContent() {
  document.getElementById('editor-content').value = STATE.aiGeneratedContent;
  nav('editor', null);
  toast('에디터에 추가되었습니다!', 'success');
}

function copyAIContentMain() {
  navigator.clipboard.writeText(STATE.aiGeneratedContent)
    .then(() => toast('콘텐츠가 복사되었습니다!', 'success'))
    .catch(() => toast('복사 실패', 'error'));
}

/* =========================================
   SCHEMA GENERATION (공통 로직)
========================================= */
function buildSchemaPrompt(schemaType, title, description, url, author) {
  const now = new Date().toISOString();
  const typePrompts = {
    article: `다음 블로그 글에 대한 Article 스키마 마크업을 JSON-LD 형식으로 생성하세요.
글 제목: ${title}
설명: ${description}
URL: ${url || 'https://example.blogspot.com'}
작성자: ${author || '작성자'}
게시일: ${now}

Article 스키마 (@type: Article)로 생성하되 headline, description, author, publisher, datePublished, dateModified, url, mainEntityOfPage 필드를 포함하세요.
순수 JSON 객체만 반환하세요 (코드블록 없이):`,

    faq: `다음 콘텐츠에 대한 FAQPage 스키마를 JSON-LD 형식으로 생성하세요.
글 제목: ${title}
설명: ${description}

FAQ 형태로 "${title}"에 관한 실제 독자들이 자주 묻는 질문 5개와 답변을 포함하는 FAQPage 스키마를 생성하세요.
@type: FAQPage, mainEntity 배열에 @type: Question 아이템 5개 포함.
순수 JSON 객체만 반환하세요:`,

    product_review: `다음 리뷰 콘텐츠에 대한 Product + Review 스키마를 JSON-LD 형식으로 생성하세요.
글 제목: ${title}
설명: ${description}
URL: ${url || 'https://example.blogspot.com'}
작성자: ${author || '작성자'}

@type: Product 스키마로 name, description, review (@type: Review), aggregateRating을 포함하세요.
review에는 reviewRating (ratingValue: 4.5, bestRating: 5), author 포함.
순수 JSON 객체만 반환하세요:`
  };

  return typePrompts[schemaType] || typePrompts.article;
}

async function generateSchemaFromAPI(schemaType, title, description, url) {
  const author = STATE.user?.name || '작성자';
  const prompt = buildSchemaPrompt(schemaType, title, description, url, author);
  const schemaObj = await callGeminiJSON(prompt, 2000);
  schemaObj['@context'] = 'https://schema.org';
  return schemaObj;
}

/* =========================================
   EDITOR AI — 스키마
========================================= */
async function editorGenerateSchema() {
  const schemaType = document.getElementById('ep-schema-type').value;
  if (!schemaType) { toast('스키마 유형을 선택해주세요.', 'error'); return; }
  if (!STATE.geminiApiKey) { toast('Gemini API 키가 필요합니다.', 'error'); nav('settings', null); return; }

  const title = document.getElementById('editor-title').value.trim() || '블로그 글';
  const description = document.getElementById('editor-content').value.trim().slice(0, 200) || title;
  const url = STATE.blogUrl || '';

  const btn = document.getElementById('ep-schema-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  document.getElementById('ep-schema-progress').style.display = 'block';
  document.getElementById('ep-schema-result').style.display = 'none';

  try {
    const schema = await generateSchemaFromAPI(schemaType, title, description, url);
    const code = '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n<\/script>';
    document.getElementById('ep-schema-code').value = code;
    document.getElementById('ep-schema-result').style.display = 'block';
    toast('스키마가 생성되었습니다!', 'success');
  } catch (e) {
    toast('스키마 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-code"></i> 스키마 생성';
    document.getElementById('ep-schema-progress').style.display = 'none';
  }
}

function copyEditorSchema() {
  const code = document.getElementById('ep-schema-code').value;
  navigator.clipboard.writeText(code)
    .then(() => toast('스키마 코드가 복사되었습니다!', 'success'))
    .catch(() => toast('복사 실패', 'error'));
}

/* =========================================
   AI SCHEMA 페이지
========================================= */
async function generateSchema() {
  const type = document.getElementById('schema-type').value;
  const title = document.getElementById('schema-title').value.trim();
  const description = document.getElementById('schema-description').value.trim();
  const url = document.getElementById('schema-url').value.trim();

  if (!type) { toast('스키마 유형을 선택해주세요.', 'error'); return; }
  if (!title || !description) { toast('제목과 설명을 입력해주세요.', 'error'); return; }
  if (!STATE.geminiApiKey) { toast('Gemini API 키가 필요합니다.', 'error'); nav('settings', null); return; }

  const btn = document.getElementById('schema-gen-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  document.getElementById('schema-progress').style.display = 'block';
  document.getElementById('schema-result').style.display = 'none';

  try {
    const schema = await generateSchemaFromAPI(type, title, description, url);
    const code = '<script type="application/ld+json">\n' + JSON.stringify(schema, null, 2) + '\n<\/script>';
    document.getElementById('schema-code').value = code;
    document.getElementById('schema-result').style.display = 'block';
    toast('스키마가 생성되었습니다!', 'success');
  } catch (e) {
    toast('스키마 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> AI 스키마 생성';
    document.getElementById('schema-progress').style.display = 'none';
  }
}

function copySchema() {
  const code = document.getElementById('schema-code').value;
  navigator.clipboard.writeText(code)
    .then(() => toast('스키마 코드가 복사되었습니다!', 'success'))
    .catch(() => toast('복사 실패', 'error'));
}

/* =========================================
   THUMBNAIL GENERATION (공통)
========================================= */
async function buildImagePromptWithGemini(topic, style) {
  const styleDesc = {
    poster:           '포스터 스타일, 대담한 타이포그래피, 강렬한 색상 대비, 상업적 포스터 디자인',
    minimal:          '미니멀 스타일, 깔끔한 흰 배경, 심플한 아이콘, 여백의 미',
    photo_realistic:  '사진 사실적 스타일, 실제 사진처럼 자연스러운 이미지, 고품질 DSLR 느낌',
    typography:       '타이포그래피 중심 디자인, 창의적인 글자 배치, 손글씨 느낌의 폰트',
    branding:         '브랜딩 스타일, 전문적인 기업 이미지, 모던한 로고 디자인, 신뢰감'
  };
  const sdesc = styleDesc[style] || styleDesc.poster;
  const prompt = `블로그 썸네일 이미지 프롬프트를 영어로 만들어주세요.
주제: ${topic}
스타일: ${sdesc}

요구사항:
- Pollinations AI에서 사용할 영어 이미지 생성 프롬프트 작성
- 1200x630 블로그 썸네일에 최적화
- 텍스트 없는 순수 이미지만
- 한 문장으로 간결하게 (최대 100 토큰)
- 프롬프트만 출력 (설명 없이)`;
  try {
    const result = await callGemini(prompt, 0.7, 200);
    return result.trim().replace(/^["']|["']$/g, '');
  } catch (e) {
    return `${topic}, ${sdesc}, blog thumbnail, 1200x630, high quality`;
  }
}

async function generateThumbnailWithWorker(topic, style) {
  const workerUrl = STATE.cfWorkerUrl;
  const imagePrompt = await buildImagePromptWithGemini(topic, style);

  if (!workerUrl) {
    // Fallback: Canvas 기반 썸네일
    return generateCanvasThumbnail(topic, style);
  }

  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: imagePrompt, width: 1200, height: 630, style })
    });
    if (!res.ok) throw new Error('Worker 응답 오류: ' + res.status);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    // Worker 실패시 Pollinations 직접 호출
    const encoded = encodeURIComponent(imagePrompt);
    return `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&nologo=true&seed=${Date.now()}`;
  }
}

function generateCanvasThumbnail(topic, style) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext('2d');
  const gradients = {
    poster:          ['#667eea', '#764ba2'],
    minimal:         ['#f5f5f5', '#e0e0e0'],
    photo_realistic: ['#1a1a2e', '#16213e'],
    typography:      ['#f093fb', '#f5576c'],
    branding:        ['#1e3c72', '#2a5298'],
  };
  const [c1, c2] = gradients[style] || gradients.poster;
  const g = ctx.createLinearGradient(0, 0, 1200, 630);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1200, 630);

  // 장식 원
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.arc(1050, 80, 200, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(150, 550, 150, 0, Math.PI*2); ctx.fill();

  // 텍스트
  const textColor = style === 'minimal' ? '#333' : 'white';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = topic.split(' ');
  const lines = []; let line = '';
  ctx.font = 'bold 68px "Fira Sans", sans-serif';
  for (const w of words) {
    const t = line + w + ' ';
    if (ctx.measureText(t).width > 1000 && line) { lines.push(line.trim()); line = w + ' '; }
    else line = t;
  }
  if (line.trim()) lines.push(line.trim());

  const startY = 315 - ((lines.length - 1) * 50);
  lines.forEach((l, i) => ctx.fillText(l, 600, startY + i * 90));

  return canvas.toDataURL('image/png');
}

/* =========================================
   EDITOR AI — 썸네일
========================================= */
async function editorGenerateThumbnail() {
  const topic = document.getElementById('ep-thumb-topic').value.trim() || document.getElementById('editor-title').value.trim();
  const style = document.getElementById('ep-thumb-style').value;
  if (!topic) { toast('썸네일 주제를 입력해주세요.', 'error'); return; }

  const btn = document.getElementById('ep-thumb-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  document.getElementById('ep-thumb-progress').style.display = 'block';
  document.getElementById('ep-thumb-result').style.display = 'none';

  try {
    const imgSrc = await generateThumbnailWithWorker(topic, style);
    const img = document.getElementById('ep-thumb-img');
    img.src = imgSrc;
    img.onload = () => {
      document.getElementById('ep-thumb-result').style.display = 'block';
      toast('썸네일 생성 완료!', 'success');
    };
    img.onerror = () => {
      // 이미지 로드 실패시 캔버스 fallback
      img.src = generateCanvasThumbnail(topic, style);
      document.getElementById('ep-thumb-result').style.display = 'block';
    };
  } catch (e) {
    toast('썸네일 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-image"></i> 썸네일 생성';
    document.getElementById('ep-thumb-progress').style.display = 'none';
  }
}

function downloadEditorThumb() {
  const img = document.getElementById('ep-thumb-img');
  if (!img || !img.src) return;
  // Canvas를 통해 다운로드
  const canvas = document.createElement('canvas');
  const ci = new Image(); ci.crossOrigin = 'anonymous';
  ci.onload = () => {
    canvas.width = ci.width || 1200; canvas.height = ci.height || 630;
    canvas.getContext('2d').drawImage(ci, 0, 0);
    const a = document.createElement('a'); a.download = 'thumbnail.png'; a.href = canvas.toDataURL(); a.click();
  };
  ci.onerror = () => { const a = document.createElement('a'); a.href = img.src; a.download = 'thumbnail'; a.click(); };
  ci.src = img.src;
  toast('썸네일 다운로드 중...', 'info');
}

/* =========================================
   AI THUMBNAIL 페이지
========================================= */
async function generateThumbnail() {
  const topic = document.getElementById('thumb-topic').value.trim();
  const style = document.getElementById('thumb-style').value;
  if (!topic) { toast('썸네일 주제를 입력해주세요.', 'error'); return; }

  const btn = document.getElementById('thumb-gen-btn');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  document.getElementById('thumb-progress').style.display = 'block';
  document.getElementById('thumb-result').style.display = 'none';

  try {
    const imgSrc = await generateThumbnailWithWorker(topic, style);
    const preview = document.getElementById('thumb-preview');
    const img = document.createElement('img');
    img.style.cssText = 'max-width:100%;border-radius:8px;box-shadow:var(--shadow-md);';
    img.src = imgSrc;
    img.onload = () => { preview.innerHTML = ''; preview.appendChild(img); document.getElementById('thumb-result').style.display = 'block'; toast('썸네일 생성 완료!', 'success'); };
    img.onerror = () => { img.src = generateCanvasThumbnail(topic, style); preview.innerHTML = ''; preview.appendChild(img); document.getElementById('thumb-result').style.display = 'block'; };
  } catch (e) {
    toast('생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-magic"></i> 썸네일 생성';
    document.getElementById('thumb-progress').style.display = 'none';
  }
}

function downloadThumbnail() {
  const img = document.querySelector('#thumb-preview img');
  if (!img) return;
  const a = document.createElement('a'); a.download = 'thumbnail.png'; a.href = img.src; a.click();
  toast('다운로드 중...', 'info');
}

/* =========================================
   SETTINGS
========================================= */
function saveAISettings() {
  const key = document.getElementById('set-gemini-key').value.trim();
  const url = document.getElementById('set-worker-url').value.trim();
  STATE.geminiApiKey = key;
  STATE.cfWorkerUrl = url;
  localStorage.setItem('geminiApiKey', key);
  localStorage.setItem('cfWorkerUrl', url);
  showApiStatus('✅ API 설정이 저장되었습니다.', 'success');
  toast('API 설정 저장 완료!', 'success');
}

async function testGeminiKey() {
  const key = document.getElementById('set-gemini-key').value.trim();
  if (!key) { toast('API 키를 먼저 입력해주세요.', 'error'); return; }
  showApiStatus('🔄 API 키 테스트 중...', '');
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: '안녕' }] }], generationConfig: { maxOutputTokens: 10 } })
    });
    if (res.ok) {
      showApiStatus('✅ API 키가 유효합니다! 정상 작동 중입니다.', 'success');
      toast('API 키 테스트 성공!', 'success');
    } else {
      const err = await res.json().catch(() => ({}));
      showApiStatus('❌ API 키 오류: ' + (err.error?.message || res.status), 'error');
    }
  } catch (e) {
    showApiStatus('❌ 연결 오류: ' + e.message, 'error');
  }
}

function showApiStatus(msg, type) {
  const el = document.getElementById('set-api-status');
  el.textContent = msg;
  el.className = type;
  el.style.display = 'block';
}

function toggleKeyVisibility(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function saveSettings() {
  if (STATE.demo) { toast('데모 모드: 실제 저장은 불가합니다.', 'info'); return; }
  toast('✅ 설정이 저장되었습니다.', 'success');
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
  localStorage.setItem('protectionSettings', JSON.stringify({
    maxClicks: document.getElementById('max-clicks').value,
    blockDuration: document.getElementById('block-duration').value,
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
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { toast('올바른 IP 주소 형식이 아닙니다.', 'error'); return; }
  if (STATE.blockedIPs.includes(ip)) { toast('이미 차단된 IP입니다.', 'error'); return; }
  STATE.blockedIPs.push(ip);
  renderBlockedIPs();
  document.getElementById('ip-input').value = '';
  toast(`${ip}가 차단되었습니다.`, 'success');
  localStorage.setItem('blockedIPs', JSON.stringify(STATE.blockedIPs));
}

function renderBlockedIPs() {
  const list = document.getElementById('blocked-ip-list');
  list.innerHTML = STATE.blockedIPs.length
    ? STATE.blockedIPs.map(ip => `<div class="ip-tag"><span>${ip}</span><span class="remove-ip" onclick="removeBlockedIP('${ip}')"><i class="fas fa-times"></i></span></div>`).join('')
    : '<p style="color:var(--text);font-size:12px;">차단된 IP가 없습니다.</p>';
}

function removeBlockedIP(ip) {
  STATE.blockedIPs = STATE.blockedIPs.filter(i => i !== ip);
  renderBlockedIPs();
  localStorage.setItem('blockedIPs', JSON.stringify(STATE.blockedIPs));
  toast(`${ip} 차단 해제`, 'info');
}

function addBlockedCountry() {
  const c = document.getElementById('country-input').value.trim().toUpperCase();
  if (!c) { toast('국가 코드를 입력해주세요.', 'error'); return; }
  if (STATE.blockedCountries.includes(c)) { toast('이미 차단된 국가입니다.', 'error'); return; }
  STATE.blockedCountries.push(c);
  renderBlockedCountries();
  document.getElementById('country-input').value = '';
  toast(`${c}가 차단되었습니다.`, 'success');
  localStorage.setItem('blockedCountries', JSON.stringify(STATE.blockedCountries));
}

function renderBlockedCountries() {
  const list = document.getElementById('blocked-country-list');
  list.innerHTML = STATE.blockedCountries.length
    ? STATE.blockedCountries.map(c => `<div class="ip-tag"><span>${c}</span><span class="remove-ip" onclick="removeBlockedCountry('${c}')"><i class="fas fa-times"></i></span></div>`).join('')
    : '<p style="color:var(--text);font-size:12px;">차단된 국가가 없습니다.</p>';
}

function removeBlockedCountry(c) {
  STATE.blockedCountries = STATE.blockedCountries.filter(x => x !== c);
  renderBlockedCountries();
  localStorage.setItem('blockedCountries', JSON.stringify(STATE.blockedCountries));
  toast(`${c} 차단 해제`, 'info');
}

function viewBlockLog() {
  openModal('차단 로그', `
    <table style="width:100%;font-size:12px;">
      <thead><tr style="border-bottom:1px solid var(--border);">
        <th style="padding:8px;text-align:left;">IP</th>
        <th style="padding:8px;text-align:left;">차단 일시</th>
        <th style="padding:8px;text-align:left;">사유</th>
        <th style="padding:8px;text-align:left;">만료</th>
      </tr></thead>
      <tbody>
        <tr><td style="padding:8px;">192.168.1.100</td><td style="padding:8px;">2025-03-28 14:30</td><td style="padding:8px;">반복 클릭</td><td style="padding:8px;">2025-03-29 14:30</td></tr>
      </tbody>
    </table>`,
    [{ label: '닫기', cls: 'btn-ghost', fn: closeModal }]);
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
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  el.className = `show ${type}`;
  el.querySelector('i').className = `fas ${icons[type] || 'fa-info-circle'}`;
  document.getElementById('toast-msg').textContent = msg;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

/* =========================================
   LOGOUT
========================================= */
function doLogout() {
  STATE.token = null; STATE.blogId = null; STATE.demo = false;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('setup-screen').style.display = 'flex';
  toast('로그아웃 되었습니다.', 'info');
}

/* =========================================
   INITIALIZATION
========================================= */
window.addEventListener('DOMContentLoaded', function () {
  // 저장된 Client ID
  const savedClientId = localStorage.getItem('googleClientId');
  if (savedClientId) document.getElementById('client-id-input').value = savedClientId;

  // 저장된 API 설정
  const savedKey = localStorage.getItem('geminiApiKey');
  const savedWorker = localStorage.getItem('cfWorkerUrl');
  if (savedKey) { STATE.geminiApiKey = savedKey; document.getElementById('set-gemini-key').value = savedKey; }
  if (savedWorker) { STATE.cfWorkerUrl = savedWorker; document.getElementById('set-worker-url').value = savedWorker; }

  // 저장된 차단 목록
  const savedIPs = localStorage.getItem('blockedIPs');
  if (savedIPs) { STATE.blockedIPs = JSON.parse(savedIPs); renderBlockedIPs(); }
  const savedCountries = localStorage.getItem('blockedCountries');
  if (savedCountries) { STATE.blockedCountries = JSON.parse(savedCountries); renderBlockedCountries(); }

  // 저장된 보호 설정
  const savedSettings = localStorage.getItem('protectionSettings');
  if (savedSettings) {
    const s = JSON.parse(savedSettings);
    document.getElementById('max-clicks').value = s.maxClicks || 3;
    document.getElementById('block-duration').value = s.blockDuration || 24;
    if (s.enabled) { document.getElementById('protection-toggle').classList.add('on'); STATE.protectionEnabled = true; }
  }
});
