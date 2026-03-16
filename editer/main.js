const { createApp, ref, computed, reactive, nextTick, onMounted, onBeforeUnmount } = window.Vue;

const LOCAL_API_PATH = '/api/blogData';
const REPO_STORAGE_KEY = 'galaxy-editor-repo-config';
const TOKEN_STORAGE_KEY = 'galaxy-editor-token';
const SIDEBAR_EXPANDED_KEY = 'galaxy-editor-sidebar-expanded';
const THEME_STORAGE_KEY = 'editor-theme';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readBooleanPreference(key, fallbackValue) {
  const storedValue = localStorage.getItem(key);
  if (storedValue === null) {
    return fallbackValue;
  }
  return storedValue === '1';
}

function writeBooleanPreference(key, value) {
  localStorage.setItem(key, value ? '1' : '0');
}

function createDefaultStarData() {
  return {
    name: 'Galaxy Blog - 星系博客',
    label: '✦ GALAXY BLOG ✦',
    title: '星系博客',
    meta: '探索无垠的思想宇宙',
    hint: '← 点击恒星查看更多 →',
    statsText: '∞ 无限想象',
    size: 2.2,
    colors: {
      core: '#d95914',
      halo: '#ff9926',
      corona: '#ff8c1f'
    },
    body: '<h2>欢迎来到星系博客</h2><p>这里的恒星首页、行星内容和卫星内容都可以通过编辑器直接维护。</p>'
  };
}

function newPlanetTemplate() {
  return {
    name: '新行星',
    subtitle: '',
    date: new Date().toISOString().split('T')[0],
    orbitRadius: 10,
    orbitSpeed: 0.05,
    spinSpeed: 0.3,
    size: 1.0,
    colors: {
      base: '#4a90d9',
      accent: '#6ec6ff',
      atmosphere: '#3a7bd5'
    },
    hasRing: false,
    ringColor: '#ffffff',
    type: 'html',
    url: '',
    content: '<h2>新的故事</h2><p>在这里写下你的博客内容。</p>',
    moons: null
  };
}

function newMoonTemplate() {
  return {
    name: '新卫星',
    size: 0.35,
    colors: {
      base: '#e06c75',
      accent: '#ffb3ba',
      atmosphere: '#c94c5a'
    },
    type: 'html',
    url: '',
    content: '<h2>卫星内容</h2><p>这里可以放二级内容。</p>'
  };
}

function serializeBlogModule(data) {
  return `export const starData = ${JSON.stringify(data.starData, null, 4)};\n\nconst blogPosts = ${JSON.stringify(data.blogPosts, null, 4)};\n\nexport default blogPosts;\n`;
}

function normalizeLoadedData(data) {
  const baseStarData = createDefaultStarData();
  const basePlanet = newPlanetTemplate();
  const baseMoon = newMoonTemplate();

  const normalizedStar = {
    ...baseStarData,
    ...(data?.starData || {}),
    colors: {
      ...baseStarData.colors,
      ...(data?.starData?.colors || {})
    }
  };

  const normalizedPosts = clone(data?.blogPosts || []).map((planet) => ({
    ...basePlanet,
    ...planet,
    type: planet?.type || 'html',
    colors: {
      ...basePlanet.colors,
      ...(planet?.colors || {})
    },
    moons: Array.isArray(planet?.moons)
      ? planet.moons.map((moon) => ({
          ...baseMoon,
          ...moon,
          type: moon?.type || 'html',
          colors: {
            ...baseMoon.colors,
            ...(moon?.colors || {})
          }
        }))
      : null
  }));

  normalizedPosts.sort((left, right) => {
    const leftRadius = Number(left.orbitRadius) || 0;
    const rightRadius = Number(right.orbitRadius) || 0;
    return leftRadius - rightRadius;
  });

  return {
    starData: normalizedStar,
    blogPosts: normalizedPosts
  };
}

function sanitizeBeforeSave(starData, blogPosts) {
  const cleanStarData = clone(starData);
  const cleanPosts = clone(blogPosts);

  cleanPosts.sort((left, right) => {
    const leftRadius = Number(left.orbitRadius) || 0;
    const rightRadius = Number(right.orbitRadius) || 0;
    return leftRadius - rightRadius;
  });

  cleanPosts.forEach((planet) => {
    planet.type = planet.type || 'html';

    if (Array.isArray(planet.moons)) {
      planet.moons = planet.moons.map((moon) => ({
        ...moon,
        type: moon.type || 'html'
      }));

      if (planet.moons.length === 0) {
        planet.moons = null;
      }
    } else {
      planet.moons = null;
    }
  });

  return {
    starData: cleanStarData,
    blogPosts: cleanPosts
  };
}

function isLocalDev() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}
function inferRepoConfig() {
  const inferred = {
    owner: '',
    repo: '',
    branch: 'main',
    filePath: 'src/blogData.js'
  };

  const { hostname, pathname } = window.location;
  if (hostname.endsWith('.github.io')) {
    inferred.owner = hostname.replace('.github.io', '');
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0 && segments[0] !== 'editer') {
      inferred.repo = segments[0];
    }
  }

  return inferred;
}

function loadStoredRepoConfig() {
  const inferred = inferRepoConfig();
  let saved = {};

  try {
    saved = JSON.parse(localStorage.getItem(REPO_STORAGE_KEY) || '{}');
  } catch (error) {
    saved = {};
  }

  const localToken = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  const sessionToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';

  return {
    owner: saved.owner || inferred.owner || '',
    repo: saved.repo || inferred.repo || '',
    branch: saved.branch || inferred.branch || 'main',
    filePath: saved.filePath || inferred.filePath || 'src/blogData.js',
    token: localToken || sessionToken || '',
    persistToken: Boolean(localToken) || Boolean(saved.persistToken)
  };
}

function persistRepoConfig(config) {
  const safeConfig = {
    owner: config.owner?.trim() || '',
    repo: config.repo?.trim() || '',
    branch: config.branch?.trim() || 'main',
    filePath: config.filePath?.trim() || 'src/blogData.js',
    persistToken: Boolean(config.persistToken)
  };

  localStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(safeConfig));

  const token = config.token?.trim() || '';
  if (safeConfig.persistToken) {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
}

function buildGitHubPath(config) {
  const encodedPath = config.filePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;
}

function buildGitHubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function encodeBase64Utf8(content) {
  const bytes = new TextEncoder().encode(content);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function decodeBase64Utf8(content) {
  const binary = atob((content || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function parseBlogModule(code) {
  const blob = new Blob([code], { type: 'text/javascript' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await import(/* @vite-ignore */ `${objectUrl}#${Date.now()}`);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

async function requestGitHub(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub API 错误（${response.status}）`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function loadFromLocalApi() {
  const response = await fetch(LOCAL_API_PATH);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || '读取本地数据失败');
  }

  return normalizeLoadedData(data);
}

async function saveToLocalApi(payload) {
  const response = await fetch(LOCAL_API_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result?.error || '写入本地数据失败');
  }
}

async function loadFromGitHub(config) {
  const url = `${buildGitHubPath(config)}?ref=${encodeURIComponent(config.branch)}`;
  const payload = await requestGitHub(url, {
    headers: buildGitHubHeaders(config.token)
  });
  const code = decodeBase64Utf8(payload.content);
  const module = await parseBlogModule(code);

  return normalizeLoadedData({
    starData: module.starData,
    blogPosts: module.default
  });
}

async function saveToGitHub(config, payload) {
  const baseUrl = buildGitHubPath(config);
  let sha;

  try {
    const current = await requestGitHub(`${baseUrl}?ref=${encodeURIComponent(config.branch)}`, {
      headers: buildGitHubHeaders(config.token)
    });
    sha = current.sha;
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }

  await requestGitHub(baseUrl, {
    method: 'PUT',
    headers: {
      ...buildGitHubHeaders(config.token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `content(editor): update blog data ${new Date().toISOString()}`,
      content: encodeBase64Utf8(serializeBlogModule(payload)),
      branch: config.branch,
      sha
    })
  });
}
const RichEditor = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
        <button
          type="button"
          class="ghost-btn"
          style="min-height:40px;padding:0 12px;"
          @click="isSourceMode = !isSourceMode"
        >
          {{ isSourceMode ? '返回富文本' : '切换到 HTML 源码' }}
        </button>
      </div>
      <div v-show="!isSourceMode" ref="editorRoot"></div>
      <textarea
        v-show="isSourceMode"
        class="source-editor"
        v-model="sourceContent"
        @input="updateSource"
      ></textarea>
    </div>
  `,
  data() {
    return {
      isSourceMode: false,
      sourceContent: ''
    };
  },
  mounted() {
    this.quill = new window.Quill(this.$refs.editorRoot, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          ['blockquote', 'code-block'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ color: [] }, { background: [] }],
          ['link', 'image', 'video'],
          ['clean']
        ]
      }
    });

    const content = this.modelValue || '';
    this.quill.clipboard.dangerouslyPasteHTML(content);
    this.sourceContent = content;
    this.resetViewport();

    this.quill.on('text-change', () => {
      this.sourceContent = this.quill.root.innerHTML;
      this.$emit('update:modelValue', this.sourceContent);
    });
  },
  methods: {
    resetViewport() {
      requestAnimationFrame(() => {
        if (!this.quill) {
          return;
        }

        const scrollingContainer = this.quill.scrollingContainer || this.quill.root.parentElement;
        if (scrollingContainer) {
          scrollingContainer.scrollTop = 0;
        }
        this.quill.root.scrollTop = 0;
        this.quill.setSelection(0, 0, 'silent');
        this.quill.blur();
      });
    },
    updateSource() {
      if (!this.quill) {
        return;
      }

      if (this.quill.root.innerHTML !== this.sourceContent) {
        this.quill.clipboard.dangerouslyPasteHTML(this.sourceContent || '');
        this.$emit('update:modelValue', this.sourceContent);
      }
    }
  },
  watch: {
    modelValue(nextValue) {
      if (!this.quill) {
        return;
      }

      const normalizedValue = nextValue || '';
      if (normalizedValue !== this.quill.root.innerHTML) {
        this.quill.clipboard.dangerouslyPasteHTML(normalizedValue);
        this.resetViewport();
      }

      if (normalizedValue !== this.sourceContent) {
        this.sourceContent = normalizedValue;
      }
    }
  }
};
createApp({
  components: {
    RichEditor
  },
  setup() {
    const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const starData = ref(createDefaultStarData());
    const planets = ref([]);
    const activeIndex = ref(-1);
    const saveStatus = ref(null);
    const isBusy = ref(false);
    const repoConfig = reactive(loadStoredRepoConfig());
    const currentTheme = ref(localStorage.getItem(THEME_STORAGE_KEY) || 'system');
    const isCompactScreen = ref(window.innerWidth <= 980);
    const desktopSidebarExpanded = ref(readBooleanPreference(SIDEBAR_EXPANDED_KEY, false));
    const mobileSidebarOpen = ref(false);
    const activeSidebarPanel = ref(null);
    const workspaceRoot = ref(null);
    let statusTimer = null;

    function setStatus(type, msg, timeout = 4200) {
      saveStatus.value = { type, msg };

      if (statusTimer) {
        clearTimeout(statusTimer);
      }

      if (timeout > 0) {
        statusTimer = setTimeout(() => {
          saveStatus.value = null;
        }, timeout);
      }
    }

    function resolveTheme(theme) {
      return theme === 'system'
        ? (systemThemeMedia.matches ? 'dark' : 'light')
        : theme;
    }

    function applyTheme(theme) {
      const resolvedTheme = resolveTheme(theme);
      document.documentElement.setAttribute('data-theme', resolvedTheme);
      document.documentElement.style.colorScheme = resolvedTheme;
    }

    function setTheme(theme) {
      currentTheme.value = theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyTheme(theme);
    }

    applyTheme(currentTheme.value);

    function handleSystemThemeChange() {
      if (currentTheme.value === 'system') {
        applyTheme('system');
      }
    }

    function scrollWorkspaceToTop() {
      nextTick(() => {
        if (workspaceRoot.value) {
          workspaceRoot.value.scrollTop = 0;
        }
        window.scrollTo(0, 0);
      });
    }

    function syncViewportState() {
      const compact = window.innerWidth <= 980;
      if (compact !== isCompactScreen.value) {
        isCompactScreen.value = compact;
        if (!compact) {
          mobileSidebarOpen.value = false;
        }
      }
    }

    onMounted(() => {
      window.addEventListener('resize', syncViewportState);
      if (typeof systemThemeMedia.addEventListener === 'function') {
        systemThemeMedia.addEventListener('change', handleSystemThemeChange);
      } else if (typeof systemThemeMedia.addListener === 'function') {
        systemThemeMedia.addListener(handleSystemThemeChange);
      }
    });

    onBeforeUnmount(() => {
      window.removeEventListener('resize', syncViewportState);
      if (typeof systemThemeMedia.removeEventListener === 'function') {
        systemThemeMedia.removeEventListener('change', handleSystemThemeChange);
      } else if (typeof systemThemeMedia.removeListener === 'function') {
        systemThemeMedia.removeListener(handleSystemThemeChange);
      }
    });

    const activePlanet = computed(() => (activeIndex.value >= 0 ? planets.value[activeIndex.value] : null));
    const isSidebarExpanded = computed(() => (isCompactScreen.value ? mobileSidebarOpen.value : desktopSidebarExpanded.value));
    const hasRepoLocation = computed(() => Boolean(repoConfig.owner && repoConfig.repo && repoConfig.branch && repoConfig.filePath));
    const hasGitHubToken = computed(() => Boolean(repoConfig.token));
    const canLoadFromGitHub = computed(() => hasRepoLocation.value);
    const canSaveToGitHub = computed(() => hasRepoLocation.value && hasGitHubToken.value);
    const canLoad = computed(() => canLoadFromGitHub.value || isLocalDev());
    const canSave = computed(() => canSaveToGitHub.value || isLocalDev());

    const currentSourceLabel = computed(() => {
      if (canSaveToGitHub.value) {
        return 'GitHub 仓库';
      }
      if (canLoadFromGitHub.value && !hasGitHubToken.value) {
        return isLocalDev() ? '本地开发接口（GitHub 缺少 Token）' : 'GitHub 仓库（缺少 Token）';
      }
      if (isLocalDev()) {
        return '本地开发接口';
      }
      return '尚未配置';
    });

    const uploadButtonLabel = computed(() => {
      if (isBusy.value) {
        return '上传中';
      }
      return canSaveToGitHub.value ? '上传' : (isLocalDev() ? '保存' : '上传');
    });

    const sidebarToggleLabel = computed(() => (isSidebarExpanded.value ? '收起侧栏' : '展开侧栏'));
    const currentSelectionLabel = computed(() => {
      if (activeIndex.value === -1) {
        return '正在编辑恒星首页';
      }
      return planets.value[activeIndex.value]?.name || '正在编辑行星';
    });

    function setDesktopSidebarExpanded(value) {
      desktopSidebarExpanded.value = value;
      writeBooleanPreference(SIDEBAR_EXPANDED_KEY, value);
    }

    function toggleSidebar() {
      if (isCompactScreen.value) {
        mobileSidebarOpen.value = !mobileSidebarOpen.value;
        if (!mobileSidebarOpen.value) {
          activeSidebarPanel.value = null;
        }
        return;
      }

      const nextValue = !desktopSidebarExpanded.value;
      setDesktopSidebarExpanded(nextValue);
      if (!nextValue) {
        activeSidebarPanel.value = null;
      }
    }

    function closeSidebar() {
      if (isCompactScreen.value) {
        mobileSidebarOpen.value = false;
      } else {
        setDesktopSidebarExpanded(false);
      }
      activeSidebarPanel.value = null;
    }

    function ensureSidebarVisible() {
      if (isCompactScreen.value) {
        mobileSidebarOpen.value = true;
      } else {
        setDesktopSidebarExpanded(true);
      }
    }

    function openSidebarPanel(panel) {
      if (activeSidebarPanel.value === panel && isSidebarExpanded.value) {
        activeSidebarPanel.value = null;
        return;
      }

      ensureSidebarVisible();
      activeSidebarPanel.value = panel;
    }

    function applyLoadedData(data) {
      starData.value = data.starData;
      planets.value = data.blogPosts;
      activeIndex.value = -1;
    }

    function selectStarHome() {
      activeIndex.value = -1;
      activeSidebarPanel.value = null;
      if (isCompactScreen.value) {
        mobileSidebarOpen.value = false;
      }
      scrollWorkspaceToTop();
    }

    function selectPlanet(index) {
      activeIndex.value = index;
      activeSidebarPanel.value = null;
      if (isCompactScreen.value) {
        mobileSidebarOpen.value = false;
      }
      scrollWorkspaceToTop();
    }

    async function loadData() {
      persistRepoConfig(repoConfig);
      isBusy.value = true;

      try {
        let loaded;
        if (canLoadFromGitHub.value) {
          loaded = await loadFromGitHub(repoConfig);
          setStatus('success', '已从 GitHub 仓库读取最新内容');
        } else if (isLocalDev()) {
          loaded = await loadFromLocalApi();
          setStatus('success', '已从本地开发接口读取内容');
        } else {
          throw new Error('请先填写 GitHub 用户名、仓库名、分支和数据文件路径');
        }

        applyLoadedData(loaded);
        scrollWorkspaceToTop();
      } catch (error) {
        setStatus('error', error.message || '读取失败', 5600);
      } finally {
        isBusy.value = false;
      }
    }

    function saveRepoSettings() {
      persistRepoConfig(repoConfig);

      if (!repoConfig.owner || !repoConfig.repo) {
        setStatus('error', '仓库配置已保存，但 GitHub 用户名和仓库名还没有填完整');
        return;
      }

      if (repoConfig.persistToken) {
        setStatus('success', '仓库配置和 Token 已保存在当前设备');
      } else {
        setStatus('success', '仓库配置已保存，Token 仅保存在当前会话');
      }
    }

    function addPlanet() {
      planets.value.push(newPlanetTemplate());
      activeIndex.value = planets.value.length - 1;
      activeSidebarPanel.value = null;

      if (isCompactScreen.value) {
        mobileSidebarOpen.value = false;
      }

      scrollWorkspaceToTop();
    }

    function deletePlanet(index) {
      if (!window.confirm('确认删除这个行星及其全部卫星吗？未保存前刷新页面仍可恢复。')) {
        return;
      }

      planets.value.splice(index, 1);
      activeIndex.value = Math.min(activeIndex.value, planets.value.length - 1);
      if (planets.value.length === 0) {
        activeIndex.value = -1;
      }
    }

    function addMoon() {
      if (!activePlanet.value) {
        return;
      }

      if (!Array.isArray(activePlanet.value.moons)) {
        activePlanet.value.moons = [];
      }

      activePlanet.value.moons.push(newMoonTemplate());
    }

    async function saveData() {
      persistRepoConfig(repoConfig);
      const payload = sanitizeBeforeSave(starData.value, planets.value);
      isBusy.value = true;

      try {
        if (canSaveToGitHub.value) {
          await saveToGitHub(repoConfig, payload);
          setStatus('success', '内容已提交到 GitHub。GitHub Pages 正在重新部署，稍等片刻即可看到更新。', 5200);
        } else if (isLocalDev()) {
          await saveToLocalApi(payload);
          setStatus('success', '内容已写回本地 src/blogData.js');
        } else {
          throw new Error('GitHub Pages 环境下请先填写完整仓库配置和 Token');
        }
      } catch (error) {
        setStatus('error', error.message || '保存失败', 5600);
      } finally {
        isBusy.value = false;
      }
    }

    loadData().catch(() => {});

    return {
      starData,
      planets,
      activeIndex,
      activePlanet,
      saveStatus,
      isBusy,
      repoConfig,
      currentTheme,
      isCompactScreen,
      isSidebarExpanded,
      activeSidebarPanel,
      workspaceRoot,
      currentSourceLabel,
      uploadButtonLabel,
      sidebarToggleLabel,
      currentSelectionLabel,
      canLoad,
      canSave,
      setTheme,
      toggleSidebar,
      closeSidebar,
      openSidebarPanel,
      saveRepoSettings,
      loadData,
      addPlanet,
      deletePlanet,
      addMoon,
      selectStarHome,
      selectPlanet,
      saveData
    };
  }
}).mount('#app');
