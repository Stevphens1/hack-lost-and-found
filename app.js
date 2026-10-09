/**
 * ============================================================================
 * Lost & Found Portal - Main Application Logic
 * AWS Services: Amazon Cognito, Amazon API Gateway, Amazon S3, Amazon DynamoDB, Amazon SNS, Amazon Bedrock (Nova Lite)
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURACIÓN AWS / API GATEWAY & COGNITO
// ============================================================================
const AWS_REGION = 'us-east-1';
const USER_POOL_ID = 'us-east-1_Www1X2mBC';
const CLIENT_ID = '65f9o7e1mst13csirabv4c2kd9';

const API_BASE_URL = 'https://zhylygp2y7.execute-api.us-east-1.amazonaws.com/dev';
const ITEMS_URL = `${API_BASE_URL}/items`;
const MATCHES_URL = `${API_BASE_URL}/matches`;

const poolData = {
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID
};

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// ============================================================================
// 2. ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================
window.activeSession = null;
window.currentUserIsStaff = false;
window.currentUserData = null;
window.currentItems = [];
window.currentMatches = [];
window.currentFilter = 'ALL'; // ALL | PENDING | VALIDATED | DELIVERED

// ============================================================================
// 3. IMÁGENES ESPECÍFICAS POR CATEGORÍA
// ============================================================================
const CATEGORY_IMAGES = {
    wallet: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80',
    smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
    backpack: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80',
    jewelry: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
    clothing: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
    keys: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80',
    other: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80'
};

function getCategoryPlaceholderImage(category) {
    const cat = String(category || '').toLowerCase();
    if (cat.includes('billetera') || cat.includes('wallet') || cat.includes('document')) {
        return CATEGORY_IMAGES.wallet;
    }
    if (cat.includes('smart') || cat.includes('celular') || cat.includes('phone') || cat.includes('tablet')) {
        return CATEGORY_IMAGES.smartphone;
    }
    if (cat.includes('mochila') || cat.includes('bolso') || cat.includes('bag') || cat.includes('backpack')) {
        return CATEGORY_IMAGES.backpack;
    }
    if (cat.includes('joya') || cat.includes('reloj') || cat.includes('watch') || cat.includes('jewelry')) {
        return CATEGORY_IMAGES.jewelry;
    }
    if (cat.includes('prenda') || cat.includes('ropa') || cat.includes('clothing') || cat.includes('polo') || cat.includes('casaca')) {
        return CATEGORY_IMAGES.clothing;
    }
    if (cat.includes('laptop') || cat.includes('comput') || cat.includes('tech') || cat.includes('electronic')) {
        return CATEGORY_IMAGES.laptop;
    }
    if (cat.includes('llave') || cat.includes('key')) {
        return CATEGORY_IMAGES.keys;
    }
    return CATEGORY_IMAGES.other;
}

// ============================================================================
// 4. CONTROLADOR DE TEMA (CLARO / OSCURO)
// ============================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}

function applyTheme(theme) {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');

    if (theme === 'dark') {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme', 'dark');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'sun');
        }
        if (themeText) {
            themeText.textContent = 'Modo Claro';
        }
    } else {
        body.classList.remove('dark-theme', 'dark');
        body.classList.add('light-theme');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'moon');
        }
        if (themeText) {
            themeText.textContent = 'Modo Oscuro';
        }
    }
    localStorage.setItem('theme', theme);
    if (window.lucide) {
        lucide.createIcons();
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// ============================================================================
// 5. UTILIDADES & SANITIZACIÓN
// ============================================================================
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function normalizeGroups(groups) {
    return (groups || []).map(group => String(group).trim().toUpperCase());
}

function formatDate(value) {
    if (!value) return 'Fecha no indicada';
    try {
        const date = new Date(`${value}T00:00:00`);
        return date.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return value;
    }
}

function getStatusInfo(status) {
    const value = String(status || 'REGISTERED').toUpperCase();
    const statuses = {
        REGISTERED: {
            label: 'Registrado',
            css: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        },
        VALIDATED: {
            label: 'Propiedad validada',
            css: 'bg-blue-500/15 text-blue-500 border-blue-500/30 font-semibold'
        },
        DELIVERED: {
            label: 'Entregado',
            css: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-semibold'
        },
        CLOSED: {
            label: 'Cerrado',
            css: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }
    };
    return statuses[value] || { label: value, css: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
}

// ============================================================================
// 6. CLIENTE HTTP AUTENTICADO CON COGNITO JWT
// ============================================================================
function getToken() {
    if (!window.activeSession) {
        throw new Error('No hay una sesión activa de AWS Cognito.');
    }
    return window.activeSession.getIdToken().getJwtToken();
}

async function apiFetch(url, options = {}) {
    const token = getToken();
    const separator = url.includes('?') ? '&' : '?';

    const response = await fetch(`${url}${separator}t=${Date.now()}`, {
        ...options,
        cache: 'no-store',
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            'Authorization': token,
            ...(options.headers || {})
        }
    });

    const responseText = await response.text();
    let result = {};

    if (responseText) {
        try {
            result = JSON.parse(responseText);
        } catch {
            console.error('Respuesta no JSON:', responseText);
            throw new Error('La API devolvió una respuesta no válida.');
        }
    }

    if (!response.ok) {
        throw new Error(result.message || `Error HTTP ${response.status}`);
    }

    return result;
}

// ============================================================================
// 7. HELPER DE COINCIDENCIAS (MATCHES)
// ============================================================================
function matchesForItem(itemID) {
    return window.currentMatches.filter(
        match => match.lostItemID === itemID || match.foundItemID === itemID
    );
}

function possibleMatchesForItem(itemID) {
    return matchesForItem(itemID).filter(
        match => String(match.status || '').toUpperCase() === 'POSSIBLE'
    );
}

function validatedMatchForItem(itemID) {
    return matchesForItem(itemID).find(
        match => String(match.status || '').toUpperCase() === 'VALIDATED'
    );
}

// ============================================================================
// 8. RENDERIZADO DE EVIDENCIA FOTOGRÁFICA Y ANÁLISIS AMAZON BEDROCK (NOVA LITE)
// ============================================================================
function safePhotoUrl(url) {
    if (typeof url !== 'string') return '';
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' ? parsed.href : '';
    } catch { return ''; }
}

function photoTile(item, label, compact = false) {
    const photo = safePhotoUrl(item?.imageUrl);
    const title = escapeHtml(item?.title || label);
    if (!photo) {
        return `
            <div class="lf-photo-tile lf-photo-empty ${compact ? 'lf-photo-small' : ''}">
                <span class="lf-empty-icon">📷</span>
                <span class="font-semibold text-xs">${escapeHtml(label)}</span>
                <small class="text-[10px] theme-text-muted">Sin foto adjunta</small>
            </div>
        `;
    }
    return `
        <button 
            type="button" 
            class="lf-photo-tile lf-photo-trigger ${compact ? 'lf-photo-small' : ''}" 
            data-photo-url="${escapeHtml(photo)}" 
            data-photo-title="${title}" 
            aria-label="Ampliar fotografía de ${title}" 
            title="Ver fotografía en alta resolución"
        >
            <img src="${escapeHtml(photo)}" alt="Fotografía real de ${title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('lf-photo-failed'); this.style.display='none'">
            <span class="lf-photo-label">${escapeHtml(label)} · Ampliar ↗</span>
            <span class="lf-photo-error">No se pudo cargar la imagen.</span>
        </button>
    `;
}

function novaAnalysisHtml(match) {
    const state = String(match.visualStatus || '').toUpperCase();
    if (!state) {
        return `
            <div class="lf-ai-info">
                Análisis visual de Amazon Bedrock pendiente o no disponible.
            </div>
        `;
    }
    if (state === 'PENDING') {
        return `
            <div class="lf-ai-card lf-ai-pending">
                <div class="lf-ai-heading">
                    <span class="lf-ai-spinner"></span> Amazon Nova Lite · Analizando fotografías
                </div>
                <p class="text-xs theme-text-muted mt-1">Comparando características visuales en AWS Bedrock...</p>
            </div>
        `;
    }
    if (state === 'NOT_AVAILABLE') {
        return `
            <div class="lf-ai-info">
                Comparación visual de Bedrock no disponible: se requiere foto en ambos reportes.
            </div>
        `;
    }
    if (state === 'ERROR') {
        return `
            <div class="lf-ai-card lf-ai-error">
                <div class="lf-ai-heading">⚠️ Amazon Nova Lite · No disponible</div>
                <p class="text-xs theme-text-muted mt-1">El score heurístico y los botones de validación siguen operativos.</p>
            </div>
        `;
    }
    if (state === 'COMPLETED') {
        const similarity = String(match.visualSimilarity || 'NO_DETERMINADA').toUpperCase();
        const className = ['ALTA', 'MEDIA', 'BAJA'].includes(similarity) ? similarity.toLowerCase() : 'unknown';
        return `
            <div class="lf-ai-card">
                <div class="lf-ai-heading">
                    <span>✨ Análisis Visual · Amazon Nova Lite</span>
                    <span class="lf-ai-badge lf-ai-${className}">${escapeHtml(similarity.replace('_',' '))}</span>
                </div>
                <div class="lf-ai-body">${escapeHtml(match.visualAnalysis || 'Sin detalles disponibles.')}</div>
                <div class="lf-ai-disclaimer">Evaluación asistida por IA generativa (Bedrock Nova Lite). La validación final corresponde a Seguridad.</div>
            </div>
        `;
    }
    return '';
}

function closePhotoViewer() {
    const modal = document.getElementById('lfPhotoViewer');
    if (modal) {
        modal.hidden = true;
        document.body.classList.remove('lf-modal-open');
    }
}

function openPhotoViewer(url, title) {
    const safe = safePhotoUrl(url);
    if (!safe) return;
    const modal = document.getElementById('lfPhotoViewer');
    if (!modal) return;
    const image = modal.querySelector('#lfPhotoViewerImage');
    if (image) {
        image.src = safe;
        image.alt = title || 'Fotografía del objeto';
    }
    const titleEl = modal.querySelector('#lfPhotoViewerTitle');
    if (titleEl) titleEl.textContent = title || 'Fotografía del objeto';
    modal.hidden = false;
    document.body.classList.add('lf-modal-open');
    modal.querySelector('.lf-photo-close')?.focus();
}

// ============================================================================
// 9. RENDERIZADO DE INTERFAZ DEL CLIENTE
// ============================================================================
function buildCustomerMatchHtml(item) {
    const validated = validatedMatchForItem(item.itemID);

    if (validated || String(item.status || '').toUpperCase() === 'VALIDATED') {
        return `
            <div class="mt-3.5 p-3.5 rounded-2xl border border-blue-500/30 bg-blue-500/5 theme-card">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">
                        ✓ Propiedad validada
                    </p>
                    <button 
                        type="button"
                        onclick="showPickupModal('${escapeHtml(item.itemID)}', '${escapeHtml(item.title)}')"
                        class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-md shadow-blue-500/20 transition-all shrink-0 cursor-pointer"
                    >
                        Ver Cita & QR
                    </button>
                </div>
                <p class="text-xs theme-text-secondary mt-1">
                    Seguridad confirmó la coincidencia de este reporte.
                </p>
            </div>
        `;
    }

    const matches = possibleMatchesForItem(item.itemID);

    if (matches.length === 0) {
        return `
            <div class="mt-3.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                <p class="text-xs theme-text-muted text-center">
                    Sin coincidencias detectadas por el momento.
                </p>
            </div>
        `;
    }

    // Verificación si IA está analizando
    const isPending = matches.some(m => String(m.visualStatus || '').toUpperCase() === 'PENDING');
    if (isPending) {
        return `
            <div class="mt-3.5 p-3.5 rounded-2xl border border-sky-500/30 bg-sky-500/5">
                <p class="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-2">
                    <span class="lf-ai-spinner"></span> Analizando similitud con Amazon Nova Lite...
                </p>
            </div>
        `;
    }

    const bestScore = Math.max(...matches.map(m => Number(m.matchScore || 0)));

    return `
        <div class="mt-3.5 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <div class="flex items-center justify-between gap-3">
                <p class="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                    🔗 Posible coincidencia encontrada
                </p>
                <span class="text-sm font-extrabold text-amber-600 dark:text-amber-300">
                    ${bestScore}%
                </span>
            </div>
            <p class="text-xs theme-text-secondary mt-1">
                Pendiente de validación por Seguridad.
            </p>
        </div>
    `;
}

function buildItemCard(item) {
    const isFound = String(item.type || '').toUpperCase() === 'FOUND';
    const status = getStatusInfo(item.status);
    let matchSection = '';

    if (!window.currentUserIsStaff) {
        matchSection = buildCustomerMatchHtml(item);
    } else {
        const possible = possibleMatchesForItem(item.itemID);
        const validated = validatedMatchForItem(item.itemID);

        if (validated) {
            matchSection = `
                <div class="mt-3.5 p-3 rounded-2xl border border-blue-500/30 bg-blue-500/5">
                    <p class="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        ✓ Coincidencia validada
                    </p>
                </div>
            `;
        } else if (possible.length > 0) {
            const best = Math.max(...possible.map(m => Number(m.matchScore || 0)));
            matchSection = `
                <div class="mt-3.5 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/5">
                    <p class="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ${possible.length} posible(s) coincidencia(s) (${best}% max)
                    </p>
                </div>
            `;
        } else {
            matchSection = `
                <div class="mt-3.5 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                    <p class="text-xs theme-text-muted text-center">Sin coincidencias detectadas.</p>
                </div>
            `;
        }
    }

    // Cabecera con Fotografía Real de S3 o Tile descriptivo
    const headerHtml = `<div class="lf-item-photo-wrap">${photoTile(item, isFound ? 'Objeto Encontrado' : 'Objeto Perdido')}</div>`;

    return `
        <article class="theme-card border rounded-3xl overflow-hidden shadow-md flex flex-col justify-between hover:shadow-xl transition-all">
            <div>
                ${headerHtml}

                <div class="p-5">
                    <div class="flex justify-between items-start gap-3">
                        <div>
                            <h3 class="font-extrabold text-base theme-text-primary">
                                ${escapeHtml(item.title || 'Sin título')}
                            </h3>
                            <p class="text-xs theme-text-muted mt-0.5">
                                ${escapeHtml(item.category || 'General')}
                            </p>
                        </div>
                        <span class="border text-[11px] px-2.5 py-0.5 rounded-full whitespace-nowrap ${status.css}">
                            ${status.label}
                        </span>
                    </div>

                    <p class="text-xs theme-text-secondary mt-3 leading-relaxed">
                        ${escapeHtml(item.description || 'Sin descripción')}
                    </p>

                    ${matchSection}
                </div>
            </div>

            <div class="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs theme-text-muted space-y-1">
                <div class="flex items-center gap-1.5">
                    <span>📍</span>
                    <span class="font-medium">${escapeHtml(item.zone || 'Zona no indicada')}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span>📅</span>
                    <span>${escapeHtml(formatDate(item.date))}</span>
                </div>
                ${
                    window.currentUserIsStaff
                        ? `<div class="pt-1 text-[10px] text-slate-400 font-mono">ID: ${escapeHtml(item.itemID)}</div>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderItems() {
    const itemsGrid = document.getElementById('itemsGrid');
    if (!itemsGrid) return;

    let items = [...window.currentItems];

    // Aplicar Filtros
    if (window.currentFilter === 'PENDING') {
        items = items.filter(i => String(i.status || '').toUpperCase() === 'REGISTERED');
    } else if (window.currentFilter === 'VALIDATED') {
        items = items.filter(i => String(i.status || '').toUpperCase() === 'VALIDATED');
    } else if (window.currentFilter === 'DELIVERED') {
        items = items.filter(i => String(i.status || '').toUpperCase() === 'DELIVERED');
    }

    if (items.length === 0) {
        itemsGrid.innerHTML = `
            <div class="col-span-full theme-card border rounded-3xl p-10 text-center">
                <p class="text-sm theme-text-muted">No hay reportes para este filtro.</p>
            </div>
        `;
        return;
    }

    items.sort((a, b) => {
        const aMatches = possibleMatchesForItem(a.itemID).length;
        const bMatches = possibleMatchesForItem(b.itemID).length;
        if (aMatches !== bMatches) return bMatches - aMatches;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    itemsGrid.innerHTML = items.map(buildItemCard).join('');
    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 10. RENDERIZADO DE COINCIDENCIAS (STAFF / SEGURIDAD)
// ============================================================================
function buildMatchCandidate(match) {
    const lost = match.lostItem || {};
    const score = Number(match.matchScore || 0);
    const status = String(match.status || 'POSSIBLE').toUpperCase();
    const isValidated = status === 'VALIDATED';
    const isRejected = status === 'REJECTED';

    let actionHtml = '';
    if (isValidated) {
        actionHtml = `
            <div class="mt-4 px-3.5 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                ✓ Coincidencia validada & Notificación enviada
            </div>
        `;
    } else if (isRejected) {
        actionHtml = `
            <div class="mt-4 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 theme-text-muted text-xs">
                Coincidencia descartada
            </div>
        `;
    } else {
        actionHtml = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <button
                    type="button"
                    class="validateMatchBtn bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-2xl transition-all text-xs shadow-sm cursor-pointer"
                    data-match-id="${escapeHtml(match.matchID)}"
                >
                    ✓ Validar
                </button>
                <button
                    type="button"
                    class="rejectMatchBtn bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-semibold py-2.5 rounded-2xl transition-all text-xs cursor-pointer"
                    data-match-id="${escapeHtml(match.matchID)}"
                >
                    ✕ Descartar
                </button>
            </div>
        `;
    }

    return `
        <div class="rounded-2xl border p-4 theme-card ${
            isValidated ? 'border-blue-500/40 bg-blue-500/5' : isRejected ? 'opacity-60' : ''
        }">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <h4 class="font-bold text-sm theme-text-primary">
                        🔎 ${escapeHtml(lost.title || 'Objeto reportado como perdido')}
                    </h4>
                    <p class="text-xs theme-text-secondary mt-1.5 leading-relaxed">
                        ${escapeHtml(lost.description || 'Sin descripción')}
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-xl font-extrabold ${
                        score >= 90 ? 'text-emerald-500' : score >= 75 ? 'text-amber-500' : 'text-blue-500'
                    }">
                        ${score}%
                    </div>
                    <span class="text-[10px] theme-text-muted">criterios</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3 text-xs theme-text-muted">
                <div>📍 ${escapeHtml(lost.zone || 'Sin zona')}</div>
                <div>📅 ${escapeHtml(formatDate(lost.date))}</div>
            </div>

            ${
                Array.isArray(match.matchedCriteria) && match.matchedCriteria.length > 0
                    ? `<div class="mt-3 flex flex-wrap gap-1.5">
                         ${match.matchedCriteria
                             .map(
                                 c => `<span class="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-medium">${escapeHtml(c)}</span>`
                             )
                             .join('')}
                       </div>`
                    : ''
            }

            <!-- Comparación Visual de Ambas Fotos -->
            <div class="lf-compare-grid">
                ${photoTile(lost, 'Objeto perdido', true)}
                ${photoTile(match.foundItem || {}, 'Objeto encontrado', true)}
            </div>

            <!-- Análisis con Amazon Bedrock Nova Lite -->
            ${novaAnalysisHtml(match)}

            ${actionHtml}
        </div>
    `;
}

function renderStaffMatches() {
    const matchesGrid = document.getElementById('matchesGrid');
    if (!matchesGrid) return;

    const matches = [...window.currentMatches];
    const possibleCount = matches.filter(
        m => String(m.status || '').toUpperCase() === 'POSSIBLE'
    ).length;

    const badge = document.getElementById('matchCountBadge');
    if (badge) badge.textContent = possibleCount;

    if (matches.length === 0) {
        matchesGrid.innerHTML = `
            <div class="theme-card border rounded-3xl p-10 text-center">
                <p class="text-sm theme-text-muted">No hay coincidencias registradas por el momento.</p>
            </div>
        `;
        return;
    }

    const groups = {};
    matches.forEach(match => {
        const foundID = match.foundItemID || 'unknown';
        if (!groups[foundID]) {
            groups[foundID] = {
                foundItem: match.foundItem || {},
                matches: []
            };
        }
        groups[foundID].matches.push(match);
    });

    const groupArray = Object.values(groups);
    groupArray.sort((a, b) => {
        const aBest = Math.max(...a.matches.map(m => Number(m.matchScore || 0)));
        const bBest = Math.max(...b.matches.map(m => Number(m.matchScore || 0)));
        return bBest - aBest;
    });

    matchesGrid.innerHTML = groupArray
        .map(group => {
            const found = group.foundItem || {};
            const candidates = [...group.matches].sort(
                (a, b) => Number(b.matchScore || 0) - Number(a.matchScore || 0)
            );

            return `
                <section class="theme-card border rounded-3xl overflow-hidden shadow-md mb-6">
                    <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-emerald-500/5">
                        <div class="flex items-start justify-between gap-4">
                            <div>
                                <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    📦 Objeto Encontrado por Seguridad
                                </span>
                                <h3 class="text-lg font-bold theme-text-primary mt-1">
                                    ${escapeHtml(found.title || 'Objeto encontrado')}
                                </h3>
                                <p class="text-xs theme-text-secondary mt-1.5">
                                    ${escapeHtml(found.description || 'Sin descripción')}
                                </p>
                            </div>
                            <span class="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                                ${candidates.length} candidato(s)
                            </span>
                        </div>
                        <div class="lf-found-photo">${photoTile(found, 'Fotografía del hallazgo')}</div>
                        <div class="flex flex-wrap gap-4 mt-3 text-xs theme-text-muted">
                            <span>📍 ${escapeHtml(found.zone || 'Sin zona')}</span>
                            <span>📅 ${escapeHtml(formatDate(found.date))}</span>
                        </div>
                    </div>

                    <div class="p-6">
                        <p class="text-xs font-semibold uppercase tracking-wider theme-text-muted mb-4">
                            Posibles reportes de pérdida relacionados:
                        </p>
                        <div class="space-y-3">
                            ${candidates.map(buildMatchCandidate).join('')}
                        </div>
                    </div>
                </section>
            `;
        })
        .join('');

    if (window.lucide) lucide.createIcons();
}

// ============================================================================
// 11. CARGA DE DATOS DESDE DYNAMODB / API GATEWAY
// ============================================================================
async function loadData() {
    const itemsGrid = document.getElementById('itemsGrid');
    if (itemsGrid) {
        itemsGrid.innerHTML = `
            <div class="col-span-full py-12 text-center text-sm theme-text-muted">
                <span class="inline-block animate-spin mr-2">⏳</span> Sincronizando con AWS...
            </div>
        `;
    }

    try {
        const itemsResult = await apiFetch(ITEMS_URL, { method: 'GET' });
        window.currentItems = Array.isArray(itemsResult.items) ? itemsResult.items : [];

        const matchesResult = await apiFetch(MATCHES_URL, { method: 'GET' });
        window.currentMatches = Array.isArray(matchesResult.matches) ? matchesResult.matches : [];

        renderItems();
        if (window.currentUserIsStaff) {
            renderStaffMatches();
        }
    } catch (error) {
        console.error('Error cargando datos de DynamoDB:', error);
        if (itemsGrid) {
            itemsGrid.innerHTML = `
                <div class="col-span-full theme-card border rounded-3xl p-8 text-center text-red-500 text-sm">
                    Error al conectar con la base de datos: ${escapeHtml(error.message)}
                </div>
            `;
        }
    }
}

// ============================================================================
// 12. MODAL DE CITA & CÓDIGO QR 100% VISIBLE (CLIENTE & STAFF)
// ============================================================================
function showPickupModal(itemId, itemTitle) {
    let modal = document.getElementById('pickupModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pickupModal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
        document.body.appendChild(modal);
    }

    const qrData = `LOST_FOUND_VALIDATION|ID:${itemId}|USER:${window.currentUserData?.email || 'Usuario'}|TIME:${Date.now()}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}&margin=1`;

    modal.innerHTML = `
        <div class="theme-card border rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button onclick="closePickupModal()" class="absolute top-4 right-4 theme-text-muted hover:theme-text-primary p-2 text-lg cursor-pointer">
                ✕
            </button>
            <div class="text-center">
                <div class="w-12 h-12 bg-sky-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-sky-500/20">
                    <span class="text-2xl">🎫</span>
                </div>
                <h3 class="text-xl font-extrabold theme-text-primary font-heading">Pase de Recojo Seguro</h3>
                <p class="text-xs theme-text-muted mt-1">${escapeHtml(itemTitle)}</p>
            </div>

            <!-- Contenedor QR Blanco con Imagen Garantizada -->
            <div class="my-6 text-center">
                <div class="qr-container mx-auto p-3 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block">
                    <img src="${qrImageUrl}" alt="Código QR de Validación" class="w-44 h-44 mx-auto rounded-lg" />
                </div>
                <p class="text-[11px] theme-text-muted mt-2.5 font-mono font-medium">Token de Verificación Anti-Fraude</p>
            </div>

            <!-- Recuadro de Instrucciones con Alto Contraste -->
            <div class="bg-sky-50 dark:bg-slate-900 border border-sky-200 dark:border-slate-700 rounded-2xl p-4 text-xs space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">📍 Lugar de entrega:</span>
                    <span class="font-bold text-slate-900 dark:text-white">Módulo Central (Piso 1)</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">🕒 Horario de atención:</span>
                    <span class="font-bold text-slate-900 dark:text-white">Lun a Dom: 10:00 AM - 9:00 PM</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-slate-600 dark:text-slate-400 font-medium">📄 Requisito obligatorio:</span>
                    <span class="font-bold text-emerald-600 dark:text-emerald-400">DNI / Documento de Identidad</span>
                </div>
            </div>

            <button onclick="closePickupModal()" class="btn-pill w-full mt-6 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition-all shadow-md shadow-sky-500/20 cursor-pointer">
                Entendido
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
}

function closePickupModal() {
    const modal = document.getElementById('pickupModal');
    if (modal) modal.classList.add('hidden');
}

// ============================================================================
// 13. GESTIÓN DE SESIÓN & COGNITO AUTH
// ============================================================================
function showApplication(session) {
    window.activeSession = session;
    const payload = session.getIdToken().decodePayload();
    window.currentUserData = payload;

    const rawGroups = payload['cognito:groups'] || [];
    const groups = normalizeGroups(rawGroups);
    const isStaff = groups.includes('STAFF');
    window.currentUserIsStaff = isStaff;

    // Reset de filtro a "Todos"
    window.currentFilter = 'ALL';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === 'ALL') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar vistas
    document.getElementById('landingView')?.classList.add('hidden');
    document.getElementById('authModal')?.classList.add('hidden');
    document.getElementById('appView')?.classList.remove('hidden');

    // Headers & Badges
    const userEmailEl = document.getElementById('currentUserEmail');
    if (userEmailEl) userEmailEl.textContent = payload.email || '';

    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        roleBadge.textContent = isStaff ? 'Personal de Seguridad (Staff)' : 'Visitante Registrado';
        roleBadge.className = isStaff
            ? 'text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full'
            : 'text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 px-3 py-1 rounded-full';
    }

    const formTitle = document.getElementById('formTitle');
    const formHelp = document.getElementById('formHelp');
    const itemType = document.getElementById('itemType');
    const submitBtnText = document.getElementById('submitBtnText');
    const itemsTitle = document.getElementById('itemsTitle');
    const itemsSubtitle = document.getElementById('itemsSubtitle');
    const staffTabs = document.getElementById('staffTabs');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');

    if (isStaff) {
        if (formTitle) formTitle.textContent = 'Registrar Objeto Encontrado';
        if (formHelp) formHelp.textContent = 'El personal de seguridad registra los objetos encontrados en el mall para iniciar el matching.';
        if (itemType) itemType.value = 'FOUND';
        if (submitBtnText) submitBtnText.textContent = 'Publicar Reporte de Hallazgo';
        if (itemsTitle) itemsTitle.textContent = 'Todos los Reportes Activos';
        if (itemsSubtitle) itemsSubtitle.textContent = 'Inventario general de objetos perdidos y hallazgos en custodia.';
        if (staffTabs) staffTabs.classList.remove('hidden');
    } else {
        if (formTitle) formTitle.textContent = 'Reportar Objeto Extraviado';
        if (formHelp) formHelp.textContent = 'Describe tu objeto para que nuestro motor de búsqueda lo compare con los hallazgos de seguridad.';
        if (itemType) itemType.value = 'LOST';
        if (submitBtnText) submitBtnText.textContent = 'Enviar Reporte de Pérdida';
        if (itemsTitle) itemsTitle.textContent = 'Mis Reportes Registrados';
        if (itemsSubtitle) itemsSubtitle.textContent = 'Seguimiento en tiempo real del estado de tus pertenencias.';
        if (staffTabs) staffTabs.classList.add('hidden');
        if (itemsView) itemsView.classList.remove('hidden');
        if (matchesView) matchesView.classList.add('hidden');
    }

    // Resetear pestañas staff
    if (tabItems && tabMatches) {
        tabItems.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm';
        tabMatches.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary';
    }

    loadData();
}

function showLanding() {
    window.activeSession = null;
    window.currentUserIsStaff = false;
    window.currentItems = [];
    window.currentMatches = [];

    document.getElementById('appView')?.classList.add('hidden');
    document.getElementById('landingView')?.classList.remove('hidden');
}

// ============================================================================
// 14. INICIALIZACIÓN DE FORMULARIOS Y EVENT LISTENERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Visor de fotos modal (delegación de eventos)
    document.addEventListener('click', event => {
        const trigger = event.target.closest('.lf-photo-trigger');
        if (trigger) openPhotoViewer(trigger.dataset.photoUrl, trigger.dataset.photoTitle);
        if (event.target.closest('[data-close-photo]')) closePhotoViewer();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closePhotoViewer();
    });

    // Polling en segundo plano para análisis pendientes de Amazon Nova Lite
    window.setInterval(() => {
        if (!window.activeSession) return;
        if (!window.currentMatches.some(m => String(m.visualStatus).toUpperCase() === 'PENDING')) return;
        
        if (window.lfRefreshingNova) return;
        window.lfRefreshingNova = true;
        
        apiFetch(MATCHES_URL, {method: 'GET'})
            .then(result => {
                window.currentMatches = Array.isArray(result.matches) ? result.matches : [];
                renderItems();
                if (window.currentUserIsStaff) {
                    renderStaffMatches();
                }
            })
            .catch(error => console.warn('Nova refresh:', error))
            .finally(() => { window.lfRefreshingNova = false; });
    }, 10000);

    // 1. Modales y Botones de Autenticación
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const toggleToRegister = document.getElementById('toggleToRegister');
    const toggleToLogin = document.getElementById('toggleToLogin');
    const toggleVerifyToLogin = document.getElementById('toggleVerifyToLogin');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const verifyTab = document.getElementById('verifyTab');
    const verifyEmailInput = document.getElementById('verifyEmail');
    const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
    const verifyCodeInput = document.getElementById('verifyCode');
    const verifyError = document.getElementById('verifyError');
    const verifySubmit = document.getElementById('verifySubmit');
    const resendCodeBtn = document.getElementById('resendCodeBtn');

    function openModal(mode = 'login', emailForVerification = '') {
        if (!authModal) return;
        authModal.classList.remove('hidden');
        loginTab?.classList.add('hidden');
        registerTab?.classList.add('hidden');
        verifyTab?.classList.add('hidden');

        if (mode === 'register') {
            registerTab?.classList.remove('hidden');
        } else if (mode === 'verify') {
            verifyTab?.classList.remove('hidden');
            if (emailForVerification) {
                if (verifyEmailInput) verifyEmailInput.value = emailForVerification;
                if (verifyEmailDisplay) verifyEmailDisplay.textContent = emailForVerification;
            }
            if (verifyCodeInput) {
                verifyCodeInput.value = '';
                verifyCodeInput.focus();
            }
            if (verifyError) verifyError.classList.add('hidden');
        } else {
            loginTab?.classList.remove('hidden');
        }
    }

    // Botones de Iniciar Sesión (Abren Modal en modo Login)
    document.querySelectorAll('.openLoginBtn').forEach(btn => {
        btn.addEventListener('click', () => openModal('login'));
    });

    // Botones de Reportar / Registrarse (Scroll a la sección de registro)
    document.querySelectorAll('.openRegisterBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const registerSection = document.getElementById('register');
            if (registerSection && document.getElementById('appView').classList.contains('hidden')) {
                registerSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                openModal('register');
            }
        });
    });

    if (closeAuthModal) closeAuthModal.addEventListener('click', () => authModal?.classList.add('hidden'));
    if (toggleToRegister) toggleToRegister.addEventListener('click', () => openModal('register'));
    if (toggleToLogin) toggleToLogin.addEventListener('click', () => openModal('login'));
    if (toggleVerifyToLogin) toggleVerifyToLogin.addEventListener('click', () => openModal('login'));

    // 2. Formulario de Inicio de Sesión
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const loginSubmit = document.getElementById('loginSubmit');

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (loginError) loginError.classList.add('hidden');
            if (loginSubmit) {
                loginSubmit.disabled = true;
                loginSubmit.textContent = 'Iniciando sesión...';
            }

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
                Username: email,
                Password: password
            });

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });

            cognitoUser.authenticateUser(authDetails, {
                onSuccess: function(session) {
                    if (loginSubmit) {
                        loginSubmit.disabled = false;
                        loginSubmit.textContent = 'Iniciar Sesión';
                    }
                    showApplication(session);
                },
                newPasswordRequired: function() {
                    const newPassword = window.prompt('Tu contraseña es temporal. Por favor ingresa una nueva contraseña:');
                    if (!newPassword) {
                        if (loginError) {
                            loginError.textContent = 'Debes ingresar una nueva contraseña.';
                            loginError.classList.remove('hidden');
                        }
                        if (loginSubmit) {
                            loginSubmit.disabled = false;
                            loginSubmit.textContent = 'Iniciar Sesión';
                        }
                        return;
                    }
                    cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
                        onSuccess: function(session) {
                            if (loginSubmit) {
                                loginSubmit.disabled = false;
                                loginSubmit.textContent = 'Iniciar Sesión';
                            }
                            showApplication(session);
                        },
                        onFailure: function(err) {
                            console.error(err);
                            if (loginError) {
                                loginError.textContent = err.message || 'Error al cambiar contraseña.';
                                loginError.classList.remove('hidden');
                            }
                            if (loginSubmit) {
                                loginSubmit.disabled = false;
                                loginSubmit.textContent = 'Iniciar Sesión';
                            }
                        }
                    });
                },
                onFailure: function(err) {
                    console.error(err);
                    if (loginSubmit) {
                        loginSubmit.disabled = false;
                        loginSubmit.textContent = 'Iniciar Sesión';
                    }

                    // Si el usuario no ha verificado su correo con el código de 6 dígitos
                    if (err.name === 'UserNotConfirmedException' || err.code === 'UserNotConfirmedException') {
                        openModal('verify', email);
                        if (verifyError) {
                            verifyError.textContent = 'Tu cuenta aún no ha sido activada. Ingresa el código de 6 dígitos que AWS envió a tu correo.';
                            verifyError.classList.remove('hidden');
                        }
                        return;
                    }

                    if (loginError) {
                        loginError.textContent = err.message || 'Credenciales no válidas.';
                        loginError.classList.remove('hidden');
                    }
                }
            });
        });
    }

    // 3. Formulario de Registro de Visitantes (Página Principal & Modal)
    function handleRegisterSubmit(formId, errorId, submitBtnId) {
        const form = document.getElementById(formId);
        const errorEl = document.getElementById(errorId);
        const submitBtn = document.getElementById(submitBtnId);
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (errorEl) errorEl.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creando cuenta...';
            }

            const prefix = formId === 'modalRegisterForm' ? 'modalReg' : 'reg';
            const name = document.getElementById(`${prefix}Name`).value.trim();
            const email = document.getElementById(`${prefix}Email`).value.trim();
            const dni = document.getElementById(`${prefix}Dni`).value.trim();
            const phone = document.getElementById(`${prefix}Phone`).value.trim();
            const password = document.getElementById(`${prefix}Password`).value;

            const attributeList = [
                new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
                new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })
            ];

            userPool.signUp(email, password, attributeList, null, function(err, result) {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Crear Cuenta y Continuar';
                }
                if (err) {
                    console.error(err);
                    if (errorEl) {
                        errorEl.textContent = err.message || 'Error al registrar usuario.';
                        errorEl.classList.remove('hidden');
                    }
                    return;
                }

                // Limpiar formulario y pasar a la pantalla de verificación de 6 dígitos
                form.reset();
                openModal('verify', email);
            });
        });
    }

    handleRegisterSubmit('registerForm', 'registerError', 'registerSubmit');
    handleRegisterSubmit('modalRegisterForm', 'modalRegisterError', 'modalRegisterSubmit');

    // 3.1. Formulario de Verificación de Código (Amazon Cognito)
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (verifyError) verifyError.classList.add('hidden');

            const email = (verifyEmailInput?.value || '').trim();
            const code = (verifyCodeInput?.value || '').trim();

            if (!email) {
                if (verifyError) {
                    verifyError.textContent = 'No se encontró el correo a verificar. Vuelve al inicio de sesión.';
                    verifyError.classList.remove('hidden');
                }
                return;
            }

            if (!code || code.length !== 6) {
                if (verifyError) {
                    verifyError.textContent = 'Por favor ingresa los 6 dígitos del código.';
                    verifyError.classList.remove('hidden');
                }
                return;
            }

            if (verifySubmit) {
                verifySubmit.disabled = true;
                verifySubmit.textContent = 'Verificando código...';
            }

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });

            cognitoUser.confirmRegistration(code, true, function(err, result) {
                if (verifySubmit) {
                    verifySubmit.disabled = false;
                    verifySubmit.textContent = 'Confirmar y Activar Cuenta';
                }

                if (err) {
                    console.error('Error confirmRegistration:', err);
                    if (verifyError) {
                        if (err.code === 'CodeMismatchException') {
                            verifyError.textContent = 'Código incorrecto. Revisa el correo y vuelve a intentar.';
                        } else if (err.code === 'ExpiredCodeException') {
                            verifyError.textContent = 'El código ha expirado. Haz clic en "Reenviar código".';
                        } else {
                            verifyError.textContent = err.message || 'Error al verificar el código.';
                        }
                        verifyError.classList.remove('hidden');
                    }
                    return;
                }

                alert('✓ ¡Cuenta activada con éxito en AWS Cognito!\n\nYa puedes iniciar sesión con tu correo y contraseña.');
                const loginEmailInput = document.getElementById('loginEmail');
                if (loginEmailInput) loginEmailInput.value = email;
                openModal('login');
            });
        });
    }

    // 3.2. Reenvío de código de confirmación
    if (resendCodeBtn) {
        resendCodeBtn.addEventListener('click', function() {
            const email = (verifyEmailInput?.value || '').trim();
            if (!email) {
                alert('No se pudo identificar el correo para el reenvío.');
                return;
            }

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: email,
                Pool: userPool
            });

            resendCodeBtn.disabled = true;
            resendCodeBtn.textContent = 'Enviando...';

            cognitoUser.resendConfirmationCode(function(err, result) {
                resendCodeBtn.disabled = false;
                resendCodeBtn.textContent = 'Reenviar código';

                if (err) {
                    console.error('Error resendConfirmationCode:', err);
                    if (verifyError) {
                        verifyError.textContent = err.message || 'No se pudo reenviar el código.';
                        verifyError.classList.remove('hidden');
                    }
                } else {
                    alert(`✓ Se ha enviado un nuevo código de 6 dígitos a ${email}`);
                }
            });
        });
    }

    // 4. Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            const currentUser = userPool.getCurrentUser();
            if (currentUser) currentUser.signOut();
            showLanding();
        });
    }

    // 5. Categoría y Zona "Otros" (Campos condicionales)
    const categorySelect = document.getElementById('category');
    const categoryOtherContainer = document.getElementById('categoryOtherContainer');
    const categoryOtherInput = document.getElementById('categoryOtherInput');

    if (categorySelect && categoryOtherContainer) {
        categorySelect.addEventListener('change', function() {
            if (this.value === 'Otros') {
                categoryOtherContainer.classList.remove('hidden');
                categoryOtherInput.required = true;
                categoryOtherInput.focus();
            } else {
                categoryOtherContainer.classList.add('hidden');
                categoryOtherInput.required = false;
                categoryOtherInput.value = '';
            }
        });
    }

    const zoneSelect = document.getElementById('zone');
    const zoneOtherContainer = document.getElementById('zoneOtherContainer');
    const zoneOtherInput = document.getElementById('zoneOtherInput');

    if (zoneSelect && zoneOtherContainer) {
        zoneSelect.addEventListener('change', function() {
            if (this.value === 'Otra Zona...') {
                zoneOtherContainer.classList.remove('hidden');
                zoneOtherInput.required = true;
                zoneOtherInput.focus();
            } else {
                zoneOtherContainer.classList.add('hidden');
                zoneOtherInput.required = false;
                zoneOtherInput.value = '';
            }
        });
    }

    // 6. Filtros de Estado para Reportes (Iluminación limpia & Alto Contraste)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            window.currentFilter = this.dataset.filter || 'ALL';
            renderItems();
        });
    });

    // 7. Delegación de Eventos para Botones de Staff (Validar / Descartar)
    const matchesGrid = document.getElementById('matchesGrid');
    if (matchesGrid) {
        matchesGrid.addEventListener('click', async function(e) {
            // Validar Match
            const validateBtn = e.target.closest('.validateMatchBtn');
            if (validateBtn) {
                const matchID = validateBtn.dataset.matchId;
                if (!matchID) return;

                const confirmed = window.confirm(
                    '¿Confirmas la validez de este reclamo?\n\n' +
                    '• El reporte del cliente se marcará como VALIDADO.\n' +
                    '• Se enviará un aviso de notificación por Amazon SNS.'
                );
                if (!confirmed) return;

                const originalText = validateBtn.innerHTML;
                validateBtn.disabled = true;
                validateBtn.innerHTML = 'Validando...';

                try {
                    const validateUrl = `${MATCHES_URL}/${encodeURIComponent(matchID)}/validate`;
                    await apiFetch(validateUrl, {
                        method: 'PATCH',
                        body: JSON.stringify({})
                    });

                    alert('✓ Coincidencia validada con éxito. Correo de notificación enviado.');
                    await loadData();
                    renderStaffMatches();
                } catch (error) {
                    console.error('Error validando match:', error);
                    alert('No se pudo validar: ' + error.message);
                    validateBtn.disabled = false;
                    validateBtn.innerHTML = originalText;
                }
                return;
            }

            // Descartar Match
            const rejectBtn = e.target.closest('.rejectMatchBtn');
            if (rejectBtn) {
                const matchID = rejectBtn.dataset.matchId;
                if (!matchID) return;

                const confirmed = window.confirm('¿Descartar esta coincidencia?');
                if (!confirmed) return;

                try {
                    const validateUrl = `${MATCHES_URL}/${encodeURIComponent(matchID)}/validate`;
                    await apiFetch(validateUrl, {
                        method: 'PATCH',
                        body: JSON.stringify({ action: 'REJECT' })
                    });

                    alert('✕ Coincidencia descartada.');
                    await loadData();
                    renderStaffMatches();
                } catch (error) {
                    console.error('Error descartando:', error);
                    alert('Error al descartar: ' + error.message);
                }
                return;
            }
        });
    }

    // 8. Vista previa de foto
    const photoInput = document.getElementById('photo');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const photoPreview = document.getElementById('photoPreview');

    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 4 * 1024 * 1024) {
                    alert('Selecciona una imagen JPG o PNG de hasta 4 MB.');
                    photoInput.value = '';
                    photoPreview.classList.add('hidden');
                    photoPlaceholder.classList.remove('hidden');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(evt) {
                    photoPreview.src = evt.target.result;
                    photoPreview.classList.remove('hidden');
                    photoPlaceholder.classList.add('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                photoPreview.classList.add('hidden');
                photoPlaceholder.classList.remove('hidden');
                photoPreview.src = '';
            }
        });
    }

    // 9. Formulario de Creación de Reportes (Items)
    const itemForm = document.getElementById('itemForm');
    if (itemForm) {
        itemForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = document.getElementById('submitBtn');
            const oldContent = submitBtn.innerHTML;
            submitBtn.disabled = true;

            try {
                let imageUrl = null;
                const file = photoInput?.files?.[0];
                let photoKey = null;

                if (file) {
                    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Selecciona una fotografía JPG o PNG.');
                    if (file.size > 4 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 4 MB.');
                    submitBtn.innerHTML = 'Subiendo imagen a S3...';
                    const presignedRes = await apiFetch(`${API_BASE_URL}/upload-url`, {
                        method: 'POST',
                        body: JSON.stringify({ fileName: file.name, fileType: file.type })
                    });

                    const s3Res = await fetch(presignedRes.uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': file.type },
                        body: file
                    });
                    if (!s3Res.ok) throw new Error('Error al subir imagen a Amazon S3');
                    imageUrl = presignedRes.imageUrl;
                    photoKey = presignedRes.photoKey || null;
                }

                submitBtn.innerHTML = 'Guardando reporte y analizando...';

                // Resolver Categoría y Zona considerando "Otros"
                let finalCategory = categorySelect.value;
                if (finalCategory === 'Otros' && categoryOtherInput && categoryOtherInput.value.trim()) {
                    finalCategory = categoryOtherInput.value.trim();
                }

                let finalZone = zoneSelect.value;
                if (finalZone === 'Otra Zona...' && zoneOtherInput && zoneOtherInput.value.trim()) {
                    finalZone = zoneOtherInput.value.trim();
                }

                const itemData = {
                    type: window.currentUserIsStaff ? 'FOUND' : 'LOST',
                    title: document.getElementById('title').value.trim(),
                    category: finalCategory,
                    zone: finalZone,
                    date: document.getElementById('itemDate').value,
                    description: document.getElementById('description').value.trim(),
                    imageUrl: imageUrl,
                    ...(photoKey ? { photoKey } : {})
                };

                if (!itemData.title || !itemData.zone || !itemData.date || !itemData.description) {
                    throw new Error('Por favor completa todos los campos requeridos.');
                }

                const result = await apiFetch(ITEMS_URL, {
                    method: 'POST',
                    body: JSON.stringify(itemData)
                });

                const matchesCreated = Number(result.matchesCreated || 0);
                if (matchesCreated > 0) {
                    alert(`✓ Reporte registrado exitosamente. Se generaron ${matchesCreated} coincidencia(s) para análisis.`);
                } else {
                    alert('✓ Reporte registrado correctamente.');
                }

                itemForm.reset();
                if (categoryOtherContainer) categoryOtherContainer.classList.add('hidden');
                if (zoneOtherContainer) zoneOtherContainer.classList.add('hidden');
                if (photoPreview) photoPreview.classList.add('hidden');
                if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
                document.getElementById('itemType').value = window.currentUserIsStaff ? 'FOUND' : 'LOST';

                await loadData();
            } catch (err) {
                console.error('Error guardando item:', err);
                alert(err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = oldContent;
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // 10. Pestañas de Staff (Items vs Matches)
    const tabItems = document.getElementById('tabItems');
    const tabMatches = document.getElementById('tabMatches');
    const itemsView = document.getElementById('itemsView');
    const matchesView = document.getElementById('matchesView');

    if (tabItems && tabMatches) {
        tabItems.addEventListener('click', () => {
            itemsView?.classList.remove('hidden');
            matchesView?.classList.add('hidden');
            tabItems.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm';
            tabMatches.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary';
        });

        tabMatches.addEventListener('click', () => {
            itemsView?.classList.add('hidden');
            matchesView?.classList.remove('hidden');
            tabItems.className = 'px-4 py-2 rounded-full text-xs font-semibold theme-text-secondary hover:theme-text-primary';
            tabMatches.className = 'px-4 py-2 rounded-full text-xs font-bold bg-sky-600 text-white shadow-sm';
            renderStaffMatches();
        });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadData());
    }
});
